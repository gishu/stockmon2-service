var parse = require('../src/CsvParser.js');
var accountMaker = require('../src/Account.js');

var getDatabase = require('../src/dataMapper/Database.js');
var getAccountMapper = require('../src/dataMapper/AccountMapper.js');
var getSnapshotMapper = require('../src/dataMapper/SnapshotMapper.js');

var fs = require('fs');
var _ = require('lodash');
var moment = require('moment');
var util = require('util');
var async = require('async');
var log = require('debug')('app');

var csv = require('fast-csv');

var dbPath = './stockmon2.sqlite';

if (process.argv.length < 4) {
    console.log('Usage: node testDrive.js accountId/name csvFilePath  createDb ');
    process.exit(1);
}


var accountId = 0,
    userName = process.argv[2],
    pathToCsv = process.argv[3],

    shouldCreateDb = process.argv[4];

if (_.isInteger(userName)) {
    accountId = _.toInteger(userName);
}

try {
    if (shouldCreateDb) {
        fs.accessSync(dbPath, fs.F_OK);

        fs.unlinkSync(dbPath);
    }
}
catch (e) {
    if (!(e.code === 'ENOENT')) {
        console.log(e);
    }

}

var database = getDatabase(dbPath);
var mapper = getAccountMapper(database);
var snapshotMapper = getSnapshotMapper(database);

var istream = fs.createReadStream(pathToCsv);

async.waterfall([
    cb => {
        if (accountId === 0) {
            cb(null, accountMaker.create(userName));
        } else {
            mapper.load(accountId, (err, acc) => cb(null, acc));
        }
    },
    (acc, cb) => {
        log('Reading csv..');
        parse(istream, (err, results) => cb(null, acc, results));
    },
    (acc, parsedResults, cb) => {
        log('Loading trades...');

        acc.register(parsedResults.trades);
        acc.addDividends(parsedResults.dividends);
        log('Saving account.');
        mapper.save(acc, (err, acc) => {
            accountId = acc.id();
            cb(null, acc);
        });
    },
    (acc, cb) => {
        log("Getting holdings..");
        acc.getHoldings((err, holdings) => {
            finalHoldings = holdings;
            cb(err, acc);
        });
    },
    (account, cb) => {
        log('Getting snapshots');
        account.getAnnualStmts((err, snapshots) => {
            cb(err, account, snapshots);
        });
    },
    (acc, snapshots, cb) => {
        log('Saving snapshots..');
        //var lastSnapshot = _.last(snapshots);
        var lastSnapshot = snapshots.forYear(2014);
        snapshots = _.initial(snapshots);
        if (snapshots.length > 0) {
            snapshotMapper.saveSnapshots(acc.id(), snapshots, (err) => {
                cb(err, acc, lastSnapshot);
            })
        } else {
            cb(null, acc, lastSnapshot);
        }

    },
    (acc, latestSnapshot, cb) => {
        var records = latestSnapshot.gains();


        if (records.length > 0) {
            //csvStream = csv.createWriteStream({ headers: true });
            csv.writeToPath('./out/gains' + accountId + '.csv',
                records,
                {
                    headers: true,
                    transform: function (row) {
                        return {
                            date: row.date.format('YYYY-MM-DD'),
                            stock: row.stock,
                            cost_price: row.CP.toString(),
                            sale_price: row.SP.toString(),
                            units: row.qty,
                            brokerage: row.brokerage.toString(),
                            gain: row.gain.toString(),
                            ST: (row.isShortTerm ? "TAX" : "FREE")
                        };
                    }
                });

        }
        records = latestSnapshot.dividends();
        if (records.length > 0) {
            csv.writeToPath('./out/divs' + accountId + '.csv',
                records,
                {
                    headers: true,
                    transform: function (row) {
                        return {
                            date: row.date.format('YYYY-MM-DD'),
                            stock: row.stock,
                            gain: row.amount.toString(),
                            ST: "DIV"
                        };
                    }
                });
        }
         acc.getHoldings((err, holdings) => {
            if (holdings.length > 0) {
                csv.writeToPath('./out/holdings' + accountId + '.csv',
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
                    });
            }
        });

        database.close(err => {
            log('Db is closed for business => ' + err);
            cb(err, accountId);
        });
    }
],
    (err, id) => {
        if (!err) {
            log('Yay! saved snapshots for ' + id);
        } else {
            log('Potti' + err);
        }

    }
);

