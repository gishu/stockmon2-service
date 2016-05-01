
describe('Account', function () {

    var account = require('../../src/Account.js');
    var BigNumber = require('bignumber.js');
    var make = require('../../src/Trade.js');
    var getBrokerage = require('../../src/HdfcBrokerage.js');
    
    it('has an id and belongs to a person', function () {
        var x = account.create(101, 'Mushu');
        expect(x.getId()).toEqual(101);
        expect(x.getName()).toEqual('Mushu');
    });

    it('can report holdings sorted alphabetically by stock name', function () {
        var a = account.create(1, 'Gishu');

        var trades = [make.makeBuy('2008-07-14', 'HDFCBANK', 10, '1030', getBrokerage),
            make.makeBuy('2009-09-03', 'HDFC', 4, '2705', getBrokerage),
            make.makeBuy('2009-09-13', 'COALIND', 10, '270', getBrokerage),
            make.makeBuy('2009-09-22', 'HDFC', 76, '1190.5', getBrokerage),
            make.makeSale('2009-09-23', 'HDFCBANK', 5, '1607.1', getBrokerage),
            make.makeSale('2009-09-31', 'COALIND', 10, '290', getBrokerage)
        ];
        var expected_holdings = [{ stock: 'HDFC', qty: 80, avg_price: new BigNumber('1266.23') },
            { stock: 'HDFCBANK', qty: 5, avg_price: new BigNumber('1030') }];
        a.register(trades);
        expect(a.getHoldings()).toJSONEqual(expected_holdings);
    });

    it('throws in case of insufficient balance for a sale', function () {
        var trades = [make.makeSale('2009-09-23', 'HDFCBANK', 5, '1607.1', getBrokerage)];
        var a = account.create(1, 'Gishu');
        expect(function () { a.register(trades); }).toThrow(
            new Error('Insufficient funds to sell 5 of HDFCBANK. Cur Balance=0'));
    });

    // it ('logs every trade to trade register', function(){
    //    pending('TBD - will need trade register'); 
    // });

    it('logs gains on every sale', function () {
        pending('TBD - will need trade matcher');
    });
});