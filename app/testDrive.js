var parse = require('../src/CsvParser.js');
var account = require('../src/Account.js');

var getDatabase = require('../src/dataMapper/Database.js');
var getAccountMapper = require('../src/dataMapper/AccountMapper.js');
var getSnapshotMapper = require('../src/dataMapper/SnapshotMapper.js');

var fs = require('fs');
var _ = require('lodash');
var moment = require('moment');
var util = require('util');
var async = require('async');
var log = require('debug')('app')

var dbPath = './stockmon.sqlite';
try {
    fs.accessSync(dbPath, fs.F_OK);
    fs.unlinkSync(dbPath);
}
catch (e) {
    if (!(e.code === 'ENOENT')) {
        console.log(e);
    }

}

var database = getDatabase(dbPath);
var mapper = getAccountMapper(database);
var snapshotMapper = getSnapshotMapper(database);

var istream = fs.createReadStream('./app/trades.csv');


async.waterfall([
    cb => {
        log('Reading csv..');
        parse(istream, (err, results) => {
            log('Loading trades...');
            var a = account.create('Gishu');
            a.register(results.trades);
            a.addDividends(results.dividends);
            cb(err, a);
        });
    },
    (account, cb) => {
        log('Saving account.');
        mapper.save(account, (err, account) => {
            cb(null, account);
        });
    },
    (account, cb) => {
        log('Getting snapshots');
        account.getAnnualStmts((err, snapshots) => {
            if (err) {
                cb(err, null);
                return;
            }
            cb(null, account.id(), snapshots);
        });
    },
    (accountId, snapshots, cb) => {
        log('Saving snapshots..');
        snapshotMapper.saveSnapshots(accountId, snapshots, (err) => {
            cb(err, accountId);
        })
    }
],
    (err, id) => {
        if (!err) {
            log('Yay! saved snapshots for ' + id);
        } else {
            log('Potti' + err);
        }
        database.close(err => log('DB Close: ' + err));
    }
);

