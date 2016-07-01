
var fs = require('fs');
var async = require('async');
var sqlite = require('sqlite3').verbose();

module.exports = function () {

    var _dbPromise = getDatabasePromise();

    function getDatabasePromise() {
        var __DB_NAME = './stockmon.sqlite';

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
                    var path = require('path');
                    if (!db_exists) {
                        db.serialize(() => {
                            async.series([
                                cb => {
                                    db.run('create table Accounts (Id INTEGER PRIMARY KEY, Name TEXT);', [], err => cb(err));
                                },
                                cb => {
                                    db.run('create table Buys(Id INTEGER PRIMARY KEY, AccountId INTEGER, Date TEXT, Stock TEXT, Qty INTEGER, Price TEXT, Brokerage TEXT, Notes TEXT,' +
                                        ' FOREIGN KEY(AccountId) REFERENCES Account(Id));', [], err => cb(err));
                                },
                                cb => {
                                    db.run('create table Sales(Id INTEGER PRIMARY KEY, AccountId INTEGER, Date TEXT, Stock TEXT, Qty INTEGER, Price TEXT, Brokerage TEXT, Notes TEXT,' +
                                        ' FOREIGN KEY(AccountId) REFERENCES Account(Id));', [], err => cb(err));
                                },
                                cb => {
                                    db.run('create table Dividends(Id INTEGER PRIMARY KEY, AccountId INTEGER, Date TEXT, Stock TEXT, Amount TEXT, Notes TEXT,' +
                                        ' FOREIGN KEY(AccountId) REFERENCES Account(Id));', [], err => cb(err));
                                },
                                cb => {
                                    db.run('create table Snapshot_Holdings(AccountId INTEGER, Year INTEGER, BuyId INTEGER, Balance INTEGER,' +
                                        ' PRIMARY KEY(AccountId, Year, BuyId), FOREIGN KEY(BuyId) REFERENCES Buys(Id),' +
                                        ' FOREIGN KEY(AccountId) REFERENCES Accounts(Id) )', [], err => cb(err));
                                },
                                cb => {
                                    db.run('CREATE TABLE Snapshot_Gains(AccountId INTEGER, Year INTEGER, SrNo INTEGER, Qty INTEGER, BuyId INTEGER, SaleId INTEGER, Brokerage TEXT, Gain TEXT,' +
                                        ' PRIMARY KEY(AccountId, Year, SrNo),' +
                                        ' FOREIGN KEY(BuyId) REFERENCES Buys(Id),' +
                                        ' FOREIGN KEY(SaleId) REFERENCES Sales(Id),' +
                                        ' FOREIGN KEY(AccountId) REFERENCES Accounts(Id) )', [], err => cb(err));
                                },
                                cb => {
                                    db.run('CREATE TABLE Snapshot_Divs(AccountId INTEGER, Year INTEGER, DivId INTEGER,' +
                                        ' PRIMARY KEY(AccountId, Year, DivId),' +
                                        ' FOREIGN KEY(DivId) REFERENCES Dividends(Id))', [], err => cb(err));
                                },
                            ],
                                (err, results) => {
                                     callback(err, db); }
                            );
                        });
                    }
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
    function serialWrapper(action) {
        _dbPromise.then(db => {
            db.serialize(() => action(db));
        });
    }
    function parallelWrapper(action) {
        _dbPromise.then(db => {
            db.serialize(() => action(db));
        });
    }

    function close(callback) {
        serialWrapper(db => {
            db.close((err) => callback(err));
        });
    }
    return {
        execute: parallelWrapper,
        executeSerial: serialWrapper,
        close: close
    };
}
