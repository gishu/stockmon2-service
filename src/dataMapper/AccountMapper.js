var account = require('../Account.js');
var sqlite = require('sqlite3').verbose();
var async = require('async');
var moment = require('moment');
var _ = require('lodash');
var make = require('../Trade.js');

var getSnapshotMapper = require('./SnapshotMapper.js');

function getAccountMapper(database) {
    var snapshotMapper = getSnapshotMapper(database);

    function _load(id, loadCallback) {
        database.execute(db => {
            var optimizedArgs, optimizeHoldings,
                buySql = 'select * from Buys where AccountId = ?',
                saleSql = 'select * from Sales where AccountId = ?',
                divSql = 'select * from Dividends where AccountId = ?',
                detailArgs = [id];

            async.waterfall([
                cb => {
                    snapshotMapper.getLatestSnapshot(id, (err, snapshot) => {
                        cb(null, snapshot);
                    });
                },
                (snapshot, cb) => {
                    if (snapshot) {
                        // If last saved fin year is 2009, we want to exclude trades older than 1-Apr-2010
                        detailArgs.push(moment([snapshot.year() + 1, 3, 1]).toISOString());
                        var dateClause = ' AND date(Date) > ?';
                        buySql += dateClause;
                        saleSql += dateClause;
                        divSql += dateClause;
                        optimizeHoldings = snapshot.holdings();
                    }
                    cb(null);
                },
                (cb) => {
                    async.parallel([
                        (acb) => {
                            db.get('select * from Accounts where Id = ?', [id], (err, row) => {
                                if (err) {
                                    acb(err, null);
                                } else {
                                    acb(null, { id: id, name: row['Name'] });
                                }
                            });
                        },
                        (acb) => {
                            db.all(buySql, detailArgs, (err, rows) => {
                                if (err) {
                                    acb(err, null);
                                } else {
                                    acb(null, _.map(rows, make.loadBuy));
                                }
                            });
                        },
                        (acb) => {
                            db.all(saleSql, detailArgs, (err, rows) => {
                                if (err) {
                                    acb(err, null);
                                } else {
                                    acb(null, _.map(rows, (row) => {
                                        var sale = make.makeSale(moment(row.Date), row.Stock, row.Qty, row.Price, row.Brokerage);
                                        sale.id = row.Id;
                                        return sale;
                                    }));
                                }
                            });
                        },
                        (acb) => {
                            db.all(divSql, detailArgs, (err, rows) => {
                                if (err) {
                                    acb(err, null);
                                } else {
                                    acb(null, _.map(rows, make.loadDiv));
                                }
                            });
                        },
                    ],
                        (err, results) => {
                            var accInfo, loadedState;
                            if (err) {
                                cb(new Error(err), null);
                                return;
                            }
                            var trades = _(results[1]).concat(results[2]).sortBy('date').value();
                            var dividends = results[3];

                            accInfo = results[0];
                            loadedState = {
                                id: accInfo['id'],
                                name: accInfo['name'],
                                trades: trades,
                                dividends: dividends,
                                holdings: optimizeHoldings || {}
                            };
                            cb(null, account.create(loadedState));
                        }
                    ); // end async parallel
                }
            ],
                (err, result) => {
                    loadCallback(err, result);
                }
            );  // end async waterfall
        });
    }


    function _save(a, saveCallback) {
        var accountId = 0;
        try {
            database.executeSerial(db => {
                var state = a.__state,
                    insertBuyStmt, insertSaleStmt, insertDivStmt;
                db.run('insert into Accounts(Name) values(?)', [state.name], function (err) {
                    if (err) { throw err; }

                    accountId = this.lastID;

                    insertBuyStmt = db.prepare('insert into buys(AccountId, Date, Stock, Qty, Price, Brokerage) values(?,?,?,?,?,?)');
                    insertSaleStmt = db.prepare('insert into sales(AccountId, Date, Stock, Qty, Price, Brokerage) values(?,?,?,?,?,?)');
                    insertDivStmt = db.prepare('insert into dividends(AccountId, Date, Stock, Amount, Notes) values(?,?,?,?,?)');

                    async.parallel([
                        (callback) => {
                            async.each(state.trades, (t, cb) => {
                                var x = [accountId, t.date.toISOString(), t.stock, t.qty, t.price.toString(), t.brokerage.toString()],
                                    stmt = (t.is_buy ? insertBuyStmt : insertSaleStmt);

                                stmt.run(x, function (err) {
                                    cb(err);
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
                                var x = [accountId, d.date.toISOString(), d.stock, d.amount.toString(), d.desc];

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
                                saveCallback(err, null);
                            } else {
                                _load(accountId, (err, acc) => { saveCallback(err, acc); });
                            }
                        });
                });
            });
        } catch (err) {
            saveCallback(new Error(err), null);
        }
    }

    return {
        load: _load,
        save: _save,
    };
}
module.exports = getAccountMapper;