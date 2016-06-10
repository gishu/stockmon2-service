describe('Account', function () {

    var path = require('path');
    var async = require('async');
    var BigNumber = require('bignumber.js');
    var _ = require('lodash');

    var make = require('../../src/Trade.js');
    var account = require('../../src/Account.js');
    var parse = require('../../src/CsvParser.js');
    var getAccountMapper = require('../../src/dataMapper/AccountMapper.js');
    var istream;

    beforeEach(() => {
        var fs = require('fs');
        fs.access('./stockmon.sqlite', fs.F_OK, err => {
            var fileExists = !err;
            if (fileExists) { fs.unlinkSync('./stockmon.sqlite'); }
        });

        var csv_path = path.resolve(__dirname, 'datafiles', 'sample_trades.csv');
        istream = fs.createReadStream(csv_path);
    });

    it('can be persisted', function (done) {
        parse(istream, function (err, results) {
            expect(err).toBeNull();
            var inMemAccount, fromDisk;
            inMemAccount = account.create('Mushu');
            inMemAccount.register(results.trades);
            inMemAccount.addDividends(results.dividends);

            var mapper = getAccountMapper();
            async.waterfall([
                (cb) => {
                    mapper.save(inMemAccount, (err, id) => {
                        cb(null, id);
                    });
                },
                (id, cb) => { var fromDisk = mapper.load(id, (err, account) => { cb(null, account); }); }
            ],
                function (err, account) {
                    if (err) {
                        done.fail(err.message);
                    }
                    expect(account.getId()).toEqual(1);
                    expect(account.getName()).toEqual('Mushu');

                    var snapshots = account.getAnnualStmts();

                    expect(snapshots[2008].dividends.length).toEqual(3);
                    var gain = _.last(snapshots[2008].dividends);
                    expect(gain.stock).toEqual('SBI');
                    expect(gain.amt.toString()).toEqual('180');

                    expect(snapshots[2009].gains.length).toEqual(2);
                    gain = _.last(snapshots[2009].gains);
                    expect(gain.stock).toEqual('HDFCBANK');
                    expect(gain.gain.toString()).toEqual('5594.31');

                    done();
                });
        });
    });
});