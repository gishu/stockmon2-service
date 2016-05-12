describe('Account', function () {

    var account = require('../../src/Account.js');
    var BigNumber = require('bignumber.js');
    var make = require('../../src/Trade.js');

    var getAccountMapper = require('../../src/dataMapper/AccountMapper.js');

    var async = require('async');

    beforeEach(() => {
        var fs = require('fs');
        fs.unlinkSync('./stockmon.sqlite');
    });

    var trades = [make.makeBuy('2008-07-14', 'HDFCBANK', 10, '1030', '69.01'),
        make.makeBuy('2009-09-03', 'HDFC', 4, '2705', '181.24'),
        make.makeBuy('2009-09-13', 'COALIND', 10, '270', '18.09'),
        make.makeBuy('2009-09-22', 'HDFC', 76, '1190.5', '606.20'),
        make.makeSale('2009-09-23', 'HDFCBANK', 5, '1607.1', '53.84'),
        make.makeSale('2009-09-31', 'COALIND', 10, '290', '19.43')
    ];
    it('can be persisted', function (done) {

        var inMemAccount, fromDisk;
        inMemAccount = account.create('Mushu');
        inMemAccount.register(trades);

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

                var holdings = account.getHoldings();
                expect(holdings[0].stock).toEqual('HDFC');
                expect(holdings[1].qty).toEqual(5);

                done();
            });
    });
});