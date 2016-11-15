
var fs = require('fs');
var async = require('async');
var sqlite = require('sqlite3');
var _ = require('lodash');
var log = require('debug')('db');

module.exports = function (pathToDatabase) {

    var _dbPromise = getDatabasePromise();

    function getDatabasePromise() {
        var __DB_NAME = pathToDatabase || ':memory:';  ;

        // to debug use require('sqlite3').verbose()
        // put in a local file path above
        //db.on('trace', (sql) => log(sql));
        // OR .on('profile', (sql, time) => {})

        log('Opening database' + __DB_NAME);
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
db.on('trace', (sql) => log(sql));
                    if (db_exists) {
                        callback(null, db);
                        return;
                    }

                    log('Creating DB at' + path.resolve(__DB_NAME));
                    db.serialize(() => {



                        var createStatements = [
                            'create table Accounts (Id INTEGER PRIMARY KEY, Name TEXT, Broker TEXT);',
                            `create table Buys(Id INTEGER PRIMARY KEY, AccountId INTEGER, Date TEXT, Stock TEXT, Qty INTEGER, Price TEXT, Brokerage TEXT, Notes TEXT,
                                    FOREIGN KEY(AccountId) REFERENCES Account(Id));`,
                            `create table Sales(Id INTEGER PRIMARY KEY, AccountId INTEGER, Date TEXT, Stock TEXT, Qty INTEGER, Price TEXT, Brokerage TEXT, Notes TEXT,
                                    FOREIGN KEY(AccountId) REFERENCES Account(Id));`,
                            `create table Dividends(Id INTEGER PRIMARY KEY, AccountId INTEGER, Date TEXT, Stock TEXT, Amount TEXT, Notes TEXT,
                                    FOREIGN KEY(AccountId) REFERENCES Account(Id));`,
                            `CREATE TABLE Statements (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL,  year INTEGER NOT NULL, created_at TEXT,
                                    long_term TEXT NOT NULL, short_term TEXT NOT NULL, dividends TEXT NOT NULL, 
                                    brokerage TEXT NOT NULL, taxes TEXT NOT NULL, net_gain TEXT NOT NULL);`,
                            `CREATE TABLE StatementHoldings(id INTEGER PRIMARY KEY, stmt_id INTEGER NOT NULL, buy_id INTEGER, Balance INTEGER, 
                                    FOREIGN KEY(buy_id) REFERENCES Buys(Id),
                                    FOREIGN KEY(stmt_id) REFERENCES Statements(id) );`,
                            `CREATE TABLE StatementGains(id INTEGER PRIMARY KEY, stmt_id INTEGER NOT NULL, Qty INTEGER, buy_id INTEGER, sale_id INTEGER, Brokerage TEXT, Gain TEXT, IsShortTerm INTEGER,
                                    FOREIGN KEY(buy_id) REFERENCES Buys(Id),
                                    FOREIGN KEY(sale_id) REFERENCES Sales(Id),
                                    FOREIGN KEY(stmt_id) REFERENCES Statements(id));`,
                            `CREATE TABLE StatementDividends(id INTEGER PRIMARY KEY, stmt_id INTEGER NOT NULL, div_id INTEGER,
                                    FOREIGN KEY(div_id) REFERENCES Dividends(Id),
                                    FOREIGN KEY(stmt_id) REFERENCES Statements(id));`
                        ];
                        var tasks = _.map(createStatements, function (s) {
                            return function (callback) {
                                db.run(s, [], err => callback(err));
                            };
                        });

                        async.series(tasks,
                            (err, results) => {
                                log('Done ' + (err ? 'with' : 'without') + ' errors');
                                callback(err, db);
                            }
                        );

                    });

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
            db.parallelize(() => action(db));
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
        close: close,
        getPath: () => ___DB_NAME
    };
}
