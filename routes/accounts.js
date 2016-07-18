var express = require('express');
var router = express.Router();

var async = require('async');
var _ = require('lodash');
var log = require('debug')('st2:route-accounts');
var tmp = require('tmp');
var csv = require('fast-csv'),
  CSV_OPTIONS = { dir: './tmp', postfix: '.csv' };
var fs = require('fs');


var parse = require('../src/CsvParser.js');
var accountMaker = require('../src/Account.js');

function createStringStream(str) {
  var stream = require('stream');
  var s = new stream.Readable();
  s._read = function noop() { };
  s.push(str);
  s.push(null);

  return s;
}



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
    accMapper = req.app.get('accountMapper');

  async.waterfall([
    (cb) => accMapper.load(accountId, (err, acc) => cb(err, acc)),
    (acc, cb) => {
      log('Reading csv..');
      parse(createStringStream(req.body), (err, results) => cb(null, acc, results));
    },
    (acc, parsedResults, cb) => {
      log('Loading trades...');

      acc.register(parsedResults.trades);
      acc.addDividends(parsedResults.dividends);
      log('Saving account.');
      accMapper.save(acc, (err, acc) => cb(err, acc));
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

router.get('/:id/snapshots/:year(\\d{4})', (req, res) => {
  var accountId = _.toInteger(req.params.id),
    year = _.toInteger(req.params.year),
    accMapper = req.app.get('accountMapper');

  async.waterfall([
    (cb) => accMapper.load(accountId,
      (err, acc) => cb(err, acc)),
    (account, cb) => account.getAnnualStmts(
      (err, snapshots) => cb(err, snapshots))
  ],
    function (err, snapshots) {
      if (err) {
        log('Failed to retrieve snapshot for ' + year + err);
        res.sendStatus(500);
        return;
      }
      var snapshot = snapshots.forYear(year);
      if (!snapshot) {
        res.sendStatus(404);
        return;
      }

      var tmpFile = tmp.fileSync(CSV_OPTIONS),
        ws = fs.createWriteStream(tmpFile.name);

      ws.on('finish', () => res.download(tmpFile.name, 'snapshot' + year + '.csv'));
      writeSnapshot(snapshot, ws);

    });

});

router.put('/:id/snapshots/:year(\\d{4})', (req, res) => {
  var accountId = _.toInteger(req.params.id),
    year = _.toInteger(req.params.year),
    accMapper = req.app.get('accountMapper'),
    snapshotMapper = req.app.get('snapshotMapper');


  async.waterfall([
    (cb) => accMapper.load(accountId,
      (err, acc) => cb(err, acc)),
    (account, cb) => account.getAnnualStmts(
      (err, snapshots) => cb(err, snapshots)),
    (snapshots, cb) => {
      var toBeSaved = _.filter(snapshots, s => s.year() >= year);
      if (toBeSaved.length == 0) {
        cb(null, null);
        return;
      }
      snapshotMapper.saveSnapshots(accountId, toBeSaved, (err) => {
        cb(err, null);
      })
    }
  ],
    function (err, snapshots) {
      if (err) {
        log('Failed to save snapshots till ' + year + err);
        res.sendStatus(500);
        return;
      }

      res.sendStatus(201);
    });
});

function writeSnapshot(snapshot, ws) {
  var csvStream = csv.format({ headers: true })
    .transform(function (row) {
      return {
        date: row.date.format('YYYY-MM-DD'),
        stock: row.stock,
        cost_price: row.CP ? row.CP.toString() : '',
        sale_price: row.SP ? row.SP.toString() : '',
        units: row.qty || '',
        brokerage: row.brokerage ? row.brokerage.toString() : '',
        gain: row.gain ? row.gain.toString() : row.amount.toString(),
        ST: (row.isShortTerm ? "TAX" : "")
      };
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
