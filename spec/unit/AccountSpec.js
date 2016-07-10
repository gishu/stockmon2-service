
describe('Account', function () {

    var account = require('../../src/Account.js');
    var BigNumber = require('bignumber.js');
    var make = require('../../src/Trade.js');

    it('has an id and belongs to a person', function () {
        var x = account.create('Mushu');
        expect(x.id()).toBeLessThan(0);
        expect(x.getName()).toEqual('Mushu');
    });



    it('can report holdings sorted alphabetically by stock name', function (done) {
        var a = account.create('Gishu');

        var trades = [make.makeBuy('2008-07-14', 'HDFCBANK', 10, '1030', '69.01'),
            make.makeBuy('2009-09-03', 'HDFC', 4, '2705', '181.24'),
            make.makeBuy('2009-09-13', 'COALIND', 10, '270', '18.09'),
            make.makeBuy('2009-09-22', 'HDFC', 76, '1190.5', '606.20'),
            make.makeSale('2009-09-23', 'HDFCBANK', 5, '1607.1', '53.84'),
            make.makeSale('2009-09-30', 'COALIND', 10, '290', '19.43')
        ];
        var expected_holdings = [{ stock: 'HDFC', qty: 80, avg_price: new BigNumber('1266.23') },
            { stock: 'HDFCBANK', qty: 5, avg_price: new BigNumber('1030') }];
        a.register(trades);
        a.getHoldings((err, holdings) => {
            expect(err).toBeNull();
            expect(holdings).toJSONEqual(expected_holdings);
            done();
        });

    });

   
    it('should not report holdings if balance qty is zero');

    it('throws in case of insufficient balance for a sale', function () {
        var trades = [make.makeSale('2009-09-23', 'HDFCBANK', 5, '1607.1', '53.84')];
        var a = account.create(1, 'Gishu');
        expect(function () { a.register(trades); }).toThrow(
            new Error('Insufficient funds to sell 5 of HDFCBANK. Cur Balance=0'));
    });

});