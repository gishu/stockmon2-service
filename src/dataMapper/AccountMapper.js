var account = require('../Account.js');
var sqlite = require('sqlite3').verbose();
var fs = require('fs');
var async = require('async');
var moment = require('moment');
var _ = require('lodash');
var make = require('../Trade.js');


function getAccountMapper() {
    var x = 10;
    var __DB_NAME = './stockmon.sqlite';
    var _dbPromise = getDatabasePromise();

    function getDatabasePromise() {
        return new Promise((resolve, reject) => {
            async.waterfall([
                callback => {
                    fs.access(__DB_NAME, fs.F_OK, err => {
                        var fileExists = !err;
                        callback(null, fileExists);
                    })
                },
                function (db_exists, callback) {
                    var db = new sqlite.Database(__DB_NAME);
                    if (!db_exists) {
                        db.serialize(() => {
                            db.run('create table Accounts (Id INTEGER PRIMARY KEY, Name TEXT);');
                            db.run('create table Buys(Id INTEGER PRIMARY KEY, AccountId INTEGER, Date TEXT, Stock TEXT, Qty INTEGER, Price TEXT, Brokerage TEXT, Notes TEXT, FOREIGN KEY(AccountId) REFERENCES Account(Id));');
                            db.run('create table Sales(Id INTEGER PRIMARY KEY, AccountId INTEGER, Date TEXT, Stock TEXT, Qty INTEGER, Price TEXT, Brokerage TEXT, Notes TEXT, FOREIGN KEY(AccountId) REFERENCES Account(Id));');
                            db.run('create table Dividends(Id INTEGER PRIMARY KEY, AccountId INTEGER, Date TEXT, Stock TEXT, Amount TEXT, Notes TEXT, FOREIGN KEY(AccountId) REFERENCES Account(Id));')
                        });
                    }
                    callback(null, db);
                }
            ],
                function (err, db) {
                    if (err) {
                        reject(new Error(err));
                    } else {
                        resolve(db)
                    }
                });
        });

    }

    function _load(id, callback) {
        _dbPromise.then(db => {
            async.parallel([
                (cb) => {
                    db.get('select * from Accounts where Id = ?', [id], (err, row) => {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, { id: id, name: row['Name'] });
                        }
                    });
                },
                (cb) => {
                    db.all('select * from Buys where AccountId = ?', [id], (err, rows) => {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, _.map(rows, (row) => make.makeBuy(moment(row.Date).toDate(), row.Stock, row.Qty, row.Price, row.Brokerage)));
                        }
                    });
                },
                (cb) => {
                    db.all('select * from Sales where AccountId = ?', [id], (err, rows) => {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, _.map(rows, (row) => make.makeSale(moment(row.Date).toDate(), row.Stock, row.Qty, row.Price, row.Brokerage)));
                        }
                    });
                },
                (cb) => {
                    db.all('select * from Dividends where AccountId = ?', [id], (err, rows) => {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, _.map(rows, (row) => make.makeDividend(moment(row.Date).toDate(), row.Stock, row.Amount, row.Notes)));
                        }
                    });
                },
            ],
                (err, results) => {
                    var accInfo, loadedState;
                    if (err) {
                        callback(new Error(err), null);
                        return;
                    }
                    var trades = _(results[1]).concat(results[2]).sortBy('date').value();
                    var dividends = results[3];
                    
                    accInfo = results[0];
                    loadedState = {
                        id: accInfo['id'],
                        name: accInfo['name'],
                        trades: trades,
                        dividends: dividends
                    };
                    callback(null, account.create(loadedState));
                }); // end async parallel
        });
    }


    function _save(a, saveCallback) {
        var accountId = 0;
        try {
            _dbPromise.then(db => {
                var state = a.__state,
                    insertBuyStmt, insertSaleStmt, insertDivStmt;
                //db.on('profile', (sql, time, x) => console.log(sql, time, x));
                db.serialize(() => {
                    db.run('insert into Accounts(Name) values(?)', [state.name], function (err) {
                        if (err) { throw err; }

                        accountId = this.lastID;

                        insertBuyStmt = db.prepare('insert into buys(AccountId, Date, Stock, Qty, Price, Brokerage) values(?,?,?,?,?,?)');
                        insertSaleStmt = db.prepare('insert into sales(AccountId, Date, Stock, Qty, Price, Brokerage) values(?,?,?,?,?,?)');
                        insertDivStmt = db.prepare('insert into dividends(AccountId, Date, Stock, Amount, Notes) values(?,?,?,?,?)');

                        async.parallel([
                            (callback) => {
                                async.each(state.trades, (t, cb) => {
                                    var x = [accountId, moment(t.date).format(), t.stock, t.qty, t.price.toString(), t.brokerage.toString()],
                                        stmt = (t.is_buy ? insertBuyStmt : insertSaleStmt);

                                    stmt.run(x, function (err) {
                                        if (err) { cb(err); return; }
                                        cb(null);
                                    });
                                },
                                    function (err) {
                                        if (err) { callback(err, null); return; }

                                        insertBuyStmt.finalize();
                                        insertSaleStmt.finalize();
                                        callback(null, null);
                                    });
                            },
                            (callback) => {
                                async.each(state.dividends, (d, cb) => {
                                    var x = [accountId, moment(d.date).format(), d.stock, d.amt.toString(), d.desc];

                                    insertDivStmt.run(x, function (err) {
                                        if (err) { cb(err); return; }
                                        cb(null);
                                    });
                                },
                                    err => {
                                        if (err) { callback(err, null); return; }
                                        insertDivStmt.finalize();
                                        callback(null, null);
                                    })
                            }
                        ],
                            (err) => {
                                if (err) {
                                    saveCallback(err, null)
                                } else {
                                    saveCallback(null, accountId);
                                }
                            });
                    });
                });
            });
        } catch (err) {
            callback(new Error(err), null);
        }
    }
    return {
        load: _load,
        save: _save,
    };
}
module.exports = getAccountMapper;