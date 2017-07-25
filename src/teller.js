var getAccountMapper = require('./dataMapper/AccountMapper.js');
var getSnapshotMapper = require('./dataMapper/SnapshotMapper.js');
var getDatabase = require('./dataMapper/Database.js');

var async = require('async');
var log = require('debug')('teller');

module.exports = function (accMapper, snapshotMapper) {
    log('teller begins');
    var _accountMapper = accMapper,
        _snapshotMapper = snapshotMapper;

    function _getStmts(accountId, callback) {
        try {

            snapshotMapper.loadSnapshots(accountId, (err, snapshots) => {
                if (err) {
                    log(err);
                    callback(err);
                    return;
                }
                if (snapshots.length > 0) {
                    callback(null, snapshots);
                    return;
                }

                async.waterfall([
                    (cb) => {
                        _accountMapper.load(accountId, (err, account) => cb(err, account));
                    },
                    (account, cb) => {
                        account.getAnnualStmts((err, snapshots) => cb(err, snapshots));
                    },
                    (snapshots, cb) => snapshotMapper.saveSnapshots(accountId, snapshots, err => cb(err, snapshots))
                ],
                    (err, snapshots) => {
                        log(err);
                        callback(err, snapshots);
                    }
                );

            });
        }
        catch (err) {
            log('Get smtms ' + (err ? 'failed with ' + err : 'succeeded'));
            callback(err, null);
        }
    }

    function _register(accountId, trades, dividends, callback) {
        var thisAccount;
        async.waterfall([
            (cb) => {
                _accountMapper.load(accountId, (err, account) => cb(err, account));
            },
            (account, cb) => {
                account.register(trades);
                account.addDividends(dividends);
                _accountMapper.save(account, (err, account) => cb(err, account.id()));
            },

            (accountId, cb) => {
                _snapshotMapper.getLatestSnapshot(accountId, (err, snapshot) => cb(err, snapshot));
            },
            (snapshot, cb) => {
                if (!snapshot) { cb(null); return; }
                
                // invalidate all cached snapshots & force recompute
                _snapshotMapper.deleteSnapshots(accountId, err => cb(err));
            },
        ],
            err => {
                log('register trades,divs ' + (err ? 'succeeded' : 'failed with ' + err));
                callback(err);
            });
    }

    function _addDividends(accountId, dividends, callback) {
        _updateAccountAndInvalidateCachedStmts(accountId, account => account.addDividends(dividends), callback);
    }

    function _updateAccountAndInvalidateCachedStmts(accountId, accountUpdateAction, callback) {
        var thisAccount;
        async.waterfall([
            (cb) => {
                _accountMapper.load(accountId, (err, account) => cb(err, account));
            },
            (account, cb) => {
                thisAccount = account;
                accountUpdateAction(account);
                cb(null, account.id());
            },
            (accountId, cb) => {
                _snapshotMapper.getLatestSnapshot(accountId, (err, snapshot) => cb(err, snapshot));
            },
            (snapshot, cb) => {
                if (!snapshot) { cb(null); return; }
                _snapshotMapper.deleteSnapshots(accountId, err => cb(err));
            }],
            err => {
                log('register trades ' + (err ? 'succeeded' : 'failed with ' + err));
                callback(err);
            });
    }

    return {
        register: _register,
        addDividends: _addDividends,
        getAnnualStmts: _getStmts
    };
};

