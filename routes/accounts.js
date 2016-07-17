var express = require('express');
var router = express.Router();

var async = require('async');
var _ = require('lodash');
var log = require('debug')('st2:route-accounts');

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

/* GET users listing. */
router.get('/', function (req, res) {
  res.send('respond with a resource');
});

router.post('/', function (req, res) {

  if (req.body.name && req.body.broker) {
    var a = accountMaker.create(req.body.name, req.body.broker),
      accMapper = req.app.get('accountMapper');

    accMapper.save(a, (err, newAcc) => {
      res.statusCode = 201;
      res.setHeader('Location', '/accounts/' + newAcc.id());
      res.end();
    });
  }
  else {
    res.statusCode = 400;
    res.end();
  }
});

router.put('/:id/trades', function (req, res, next) {
  console.log(req.is('text'));
  console.log();
  console.log(req.is('csv'));


  if (!req.is('text/csv')) {
    res.statusCode = 400;
    res.write('Content-Type must be text/csv');
    res.end();
    return;
  }
  log('start the engines');
  //res.send(req.params.id + '-' + JSON.stringify(req.body));
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
      log(err);

      if (err){
        res.statusCode = 500;
        res.end();
        return;
      }
      res.send('DONE!');
    });

});

module.exports = router;
