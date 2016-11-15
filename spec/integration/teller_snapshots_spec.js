describe('Teller', function () {

    var async = require('async');
    var _ = require('lodash');


    var parse = require('../../src/CsvParser.js');
    var account = require('../../src/Account.js');
    var make = require('../../src/Trade.js');
    var createTeller = require('../../src/teller.js');

    var getAccountMapper = require('../../src/dataMapper/AccountMapper.js');
    var getSnapshotMapper = require('../../src/dataMapper/SnapshotMapper.js');
    
    var helpers = require('../helpers/test_helper.js');

    var mapper, snapshotMapper,
        savedAccount,
        teller;

    beforeEach(done => {
        noOp = () => { };
        mapper = getAccountMapper();
        snapshotMapper = getSnapshotMapper();
        teller = createTeller(mapper, snapshotMapper);

        savedAccount = { name: 'mockAccount', id: () => 5, addDividends: noOp, register: noOp, getAnnualStmts: noOp };
        done();
    });

    it('will return cached annual stmts if present', (done) => {
        var CACHED_SNAPSHOTS = [{ 'desc': 'someSnapshot' }];
        spyOn(snapshotMapper, 'loadSnapshots').and.callFake((accountId, callback) => callback(null, CACHED_SNAPSHOTS));

        teller.getAnnualStmts(savedAccount.id(), (err, snapshots) => {
            expect(snapshots).toBe(CACHED_SNAPSHOTS);
            done();
        });
    });
    it('will compute annual stmts and cache results if absent', done => {
        var NO_SNAPSHOTS = [],
            COMPUTED_SNAPSHOTS = [{ 'desc': 'someSnapshot' }];

        spyOn(snapshotMapper, 'loadSnapshots').and.callFake((accountId, callback) => callback(null, NO_SNAPSHOTS));
        spyOn(mapper, 'load').and.callFake((accountId, callback) => {
            callback(null, savedAccount);
        });
        spyOn(savedAccount, 'getAnnualStmts').and.callFake(callback => callback(null, COMPUTED_SNAPSHOTS));
        spyOn(snapshotMapper, 'saveSnapshots').and.callFake((accountId, snapshots, callback) => callback(null));

        teller.getAnnualStmts(savedAccount.id(), (err, snapshots) => {
            expect(snapshots).toBe(COMPUTED_SNAPSHOTS);
            expect(snapshotMapper.saveSnapshots).toHaveBeenCalled();
            done();
        });
    });

    it('can save new trades & invalidate cached stmts', (done) => {
        spyOn(mapper, 'load').and.callFake((accountId, callback) => {
            callback(null, savedAccount);
        });
        spyOn(savedAccount, 'register');
        spyOn(savedAccount, 'addDividends');
        spyOn(mapper, 'save').and.callFake((account, callback) => callback(null, savedAccount));
        spyOn(snapshotMapper, 'getLatestSnapshot').and.callFake((accountId, callback) => callback(null, { 'desc': 'someSnapshot' }));
        spyOn(snapshotMapper, 'deleteSnapshots').and.callFake((accountId, callback) => callback(null));;

        var trades = [make.makeBuy('2015-07-14', 'HDFCBANK', 10, '1030', '69.01')];
        var divs = [make.makeDividend('2014-05-14', 'TATA MOTORS', '250', 'NEW')];
        teller.register(savedAccount.id(), trades, divs, err => {
            if (err) {
                done.fail(err);
                return;
            }

            expect(mapper.load.calls.first().args[0]).toEqual(savedAccount.id());
            expect(savedAccount.register).toHaveBeenCalled();
            expect(savedAccount.addDividends).toHaveBeenCalled();
            expect(mapper.save).toHaveBeenCalled();
            expect(snapshotMapper.deleteSnapshots).toHaveBeenCalled();
            done();
        });
    });

    it('will not flush cache if cache is empty', done => {
        var NO_SNAPSHOT = null;

        spyOn(mapper, 'load').and.callFake((accountId, callback) => {
            callback(null, savedAccount);
        });
        spyOn(savedAccount, 'register');
        spyOn(savedAccount, 'addDividends');
        spyOn(mapper, 'save').and.callFake((account, callback) => callback(null, savedAccount));
        spyOn(snapshotMapper, 'getLatestSnapshot').and.callFake((accountId, callback) => callback(null, NO_SNAPSHOT));
        spyOn(snapshotMapper, 'deleteSnapshots').and.callFake((accountId, callback) => callback(null));

        var divs = [make.makeDividend('2014-05-14', 'TATA MOTORS', '250', 'NEW')];
        teller.addDividends(savedAccount.id(), divs, err => {
            if (err) {
                done.fail(err);
                return;
            }

            expect(snapshotMapper.deleteSnapshots).not.toHaveBeenCalled();
            done();

        });
    })

});
