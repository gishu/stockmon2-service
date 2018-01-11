var express = require('express');
var router = express.Router();

var async = require('async');
var _ = require('lodash');
var moment = require('moment');
var log = require('debug')('st2:route-accounts');
var tmp = require('tmp');
var csv = require('fast-csv'),
  CSV_OPTIONS = { dir: './tmp', postfix: '.csv' };
var fs = require('fs');
var BigNumber = require('bignumber.js');



var parse = require('../src/CsvParser.js');
var accountMaker = require('../src/Account.js');
var makeTeller = require('../src/teller.js');

function createStringStream(str) {
  var stream = require('stream');
  var s = new stream.Readable();
  s._read = function noop() { };
  s.push(str);
  s.push(null);

  return s;
}

// create ./tmp folder for writing out temp csv files
fs.access('./tmp', fs.W_OK, err => {
  if (err && (err.code === "ENOENT")) {
    fs.mkdirSync('./tmp');
  }
});

router.post('/', function (req, res) {

  if (req.body.name && req.body.broker) {
    var a = accountMaker.create(req.body.name, req.body.broker),
      accMapper = req.app.get('accountMapper');

    accMapper.save(a, (err, newAcc) => {
      res.location('/accounts/' + newAcc.id());
      res.sendStatus(201);
    });
  }
  else {
    res.sendStatus(400);
  }
});

router.put('/:id/trades', function (req, res, next) {

  if (!req.is('text/csv')) {
    res.statusCode = 400;
    res.json({ 'error': 'Content-Type must be text/csv' });
    res.end();
    return;
  }

  var accountId = _.toInteger(req.params.id),
    accMapper = req.app.get('accountMapper'),
    snapshotMapper = req.app.get('snapshotMapper');

  async.waterfall([
    (cb) => {
      parse(createStringStream(req.body), (err, results) => cb(null, results));
    },
    (parsedResults, cb) => {
      var teller = makeTeller(accMapper, snapshotMapper);
      teller.register(accountId, parsedResults.trades, parsedResults.dividends, err => cb(err));
    }],
    function (err, result) {
      if (err) {
        log(err);
        res.sendStatus(500);
        return;
      }
      res.sendStatus(200);
    });

});

router.get('/:id/holdings', (req, res) => {
  var accountId = _.toInteger(req.params.id),
    accMapper = req.app.get('accountMapper');

  async.waterfall([
    (cb) => accMapper.load(accountId, (err, acc) => cb(err, acc)),
    (acc, cb) => {
      acc.getHoldings((err, holdings) => cb(err, holdings));
    }],
    function (err, holdings) {
      res.format({
        'text/csv': () => writeHoldingsAsCsvAttachment(holdings, res)
      });
    });

});

router.get('/:id/snapshots', (req, res) => {
  var accountId = _.toInteger(req.params.id),
    accMapper = req.app.get('accountMapper'),
    snapshotMapper = req.app.get('snapshotMapper'),
    teller = makeTeller(accMapper, snapshotMapper);

  teller.getAnnualStmts(accountId, (err, snapshots) => {
    if (err) {
      log('Failed to retrieve snapshot for ' + year + err);
      res.sendStatus(500);
      return;
    }
    try {
      var peeks = snapshots.map(function (s) {
        return {
          year: s.year(),
          url: '/accounts' + req.url + '/' + s.year(),
          longTerm: s.longTermGains(),
          shortTerm: s.shortTermGains(),
          dividends: _.reduce(s.dividends(), (sum, d) => sum.plus(d.amount), new BigNumber(0)),
          taxes: s.taxes().toFixed(2),
          net: s.netGain().toFixed(2)
        };
      });
      res.json(peeks);
    }
    catch (err) {
      log(err);
      res.sendStatus(500);
      return;
    }
  });
});

router.get('/:id/snapshots/:year(\\d{4})/gains', (req, res) => {
  _getStatement(req.params, req.app.get('accountMapper'), req.app.get('snapshotMapper'), (err, snapshot) => {
    if (err) {
      res.sendStatus(500);
      return;
    }
    if (!snapshot) {
      res.sendStatus(404);
      return;
    }

    res.format({
      'application/json': () => {
        res.json({
          gains: snapshot.gains(),
          dividends: snapshot.dividends()
        });
      },
      'text/csv': () => {
        var tmpFile = tmp.fileSync(CSV_OPTIONS),
          ws = fs.createWriteStream(tmpFile.name),
          year = _.toInteger(req.params.year);

        ws.on('finish', () => res.download(tmpFile.name, 'snapshot' + year + '.csv'));
        writeSnapshot(snapshot, ws);
      }
    });

  });
});

router.get('/:id/snapshots/:year(\\d{4})/holdings', (req, res) => {
  res.format(
    {
      'text/html': () => res.render('holdings', { year: req.params.year }),

      'application/json': () => {
        _getStatement(req.params, req.app.get('accountMapper'), req.app.get('snapshotMapper'), (err, snapshot) => {
          if (err) {
            res.sendStatus(500);
            return;
          }
          if (!snapshot) {
            res.sendStatus(404);
            return;
          }

          var viewModel = [],
            holdings = snapshot.holdings(),
            keys,
            today = moment();


          keys = _(holdings).keys().filter(k => holdings[k].length > 0).value();
          keys.sort();

          _.each(keys, stock => {
            var trades = holdings[stock];
            viewModel = _.concat(viewModel, _.map(trades, t => {
              return {
                stock: t.stock,
                date: t.date.format('YYYY-MM-DD'),
                qty: t.balance,
                price: t.price,
                age_months: today.diff(t.date, 'months'),
                notes: t.notes
              };
            }));

          });

          res.json(viewModel);
        });
      }
    });

});

router.get('/:id/trades', function (req, res, next) {
  res.format({
    'text/html': () => {
      res.render('trades');
    },

    'application/json': () => {
      var accountId = _.toInteger(req.params.id),
        accMapper = req.app.get('accountMapper');


      accMapper.load(accountId, (err, acc) => {
        log('Loaded account');
        var response = _.map(acc.trades(), t => {
          return {
            'date': t.date.format('YYYY-MM-DD'),
            'stock': t.stock,
            'qty': t.qty,
            'price': t.price,
            'type': t.is_buy ? 'BUY' : 'SELL'
          };
        });
        res.json(response);
      });

    }
  })
});

function _getStatement(params, mapper, stmtMapper, callback) {
  var accountId = _.toInteger(params.id),
    year = _.toInteger(params.year),
    teller = makeTeller(mapper, stmtMapper);

  teller.getAnnualStmts(accountId, (err, snapshots) => {
    if (err) {
      log('Failed to retrieve snapshot for ' + year + err);
      res.sendStatus(500);
      callback(err, null);
      return;
    }

    callback(null, snapshots.forYear(year));
  });
}

function writeSnapshot(snapshot, ws) {
  var csvStream = csv.format({ headers: true })
    .transform(function (row) {

      if (row.qty) {
        return {
          date: row.date.format('YYYY-MM-DD'),
          stock: row.stock,
          cost_price: row.CP.toString(),
          buyDate: row.buyDate.format('YYYY-MM-DD'),
          sale_price: row.SP.toString(),
          units: row.qty,
          brokerage: row.brokerage.toString(),
          gain: row.gain.toString(),
          roi: row.roi,
          ST: (row.isShortTerm ? "TAX" : "")
        }
      }
      else {
        return {
          date: row.date.format('YYYY-MM-DD'),
          stock: row.stock,
          cost_price: '',
          buyDate: '',
          sale_price: '',
          units: '',
          brokerage: '',
          gain: row.amount.toString(),
          roi: '',
          ST: ''
        };
      }

    });

  csvStream.pipe(ws);

  snapshot.gains().forEach(value => csvStream.write(value));
  snapshot.dividends().forEach(value => csvStream.write(value));

  csvStream.end();

}

function writeHoldingsAsCsvAttachment(holdings, res) {

  var tmpFile = tmp.fileSync(CSV_OPTIONS);

  csv.writeToPath(tmpFile.name,
    holdings,
    {
      headers: true,
      transform: function (row) {
        return {
          Stock: row.stock,
          Units: row.qty,
          AveragePrice: row.avg_price.toString()
        };
      }
    }).on('finish', () => res.download(tmpFile.name, 'holdings.csv'));

}

module.exports = router;
