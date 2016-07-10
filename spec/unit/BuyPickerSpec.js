var matcher = require('../../src/BuyPicker.js');
var make = require('../../src/Trade.js');

var _ = require('lodash');


describe('TradeMatcher', () => {
    var buys = [{ id: 1, balance: 10 }, { id: 2, balance: 50 }, { id: 3, balance: 20 }];
    var id;
    beforeEach(() => {
        id = 1;
    })

    it('can match a sale to multiple buys', () => {
        var buys = getBuys([
            ['2010-01-02', 10, '100'], // date, qty, price
            ['2010-02-02', 50, '70'],
            ['2010-03-02', 20, '50']
        ]),
            sales = getSales([['2010-10-01', 30, '250']]);
        expect(matcher(buys, sales)).toEqual([
            { saleId: 4, buyIds: [1, 2] }
        ]);
    });

    it('throws if saleQty exceeds available holdings', () => {
        var buys = getBuys([
            ['2010-01-02', 10, '100']
        ]),
            sales = getSales([['2010-10-01', 30, '250']]);
        expect(() => matcher(buys, sales)).toThrowError("Insufficient holdings!");
    });


    it('picks long term buys over short term to avoid tax', () => {
        var buys = getBuys([
            ['2008-04-01', 20, '200'],
            ['2008-12-01', 15, '180']
        ]);
        var sales = getSales([
            ['2009-05-01', 20, '300'],
            ['2010-01-01', 15, '250']
        ]);

        expect(matcher(buys, sales)).toEqual([
            { saleId: 3, buyIds: [1] },
            { saleId: 4, buyIds: [2] }
        ]);

    });

    it('matches buys with minimum Short Term gain to reduce capital gains tax', () => {
        var buys = getBuys([
            ['2008-04-01', 10, '200'],
            ['2008-12-01', 10, '180'],
            ['2009-01-01', 10, '250']
        ]);
        var sales = getSales([
            ['2009-03-01', 10, '300']
        ]);

        expect(matcher(buys, sales)).toEqual([
            { saleId: 4, buyIds: [3] }
        ]);

    });

    it('match order - prefer LT buy with lowest CP (max gain), then ST buy with highest CP (min gain > min capital gains tax)', () => {
        var buys = getBuys([
            ['2013-03-07', 500, '48.5'],
            ['2013-03-20', 500, '44.9'],
            ['2013-06-27', 500, '39.35'],

            ['2014-05-16', 600, '57.13'],
            ['2014-09-25', 1000, '45.5'],
            ['2015-03-27', 500, '46.3'],

            ['2015-07-10', 1000, '28.4'],
        ]);
        var sales = getSales([
            ['2013-05-20', 500, '52.5'],
            ['2013-05-21', 250, '61.6'],

            ['2014-04-01', 250, '48'],
            ['2014-04-10', 250, '58'],
            ['2015-01-23', 250, '50.7'],
            ['2015-02-24', 500, '56.75'],
        ]);

        expect(matcher(buys, sales)).toEqual(
            [
                { saleId: 9, buyIds: [1] },
                { saleId: 8, buyIds: [1, 2] },
                { saleId: 11, buyIds: [2] },
                { saleId: 10, buyIds: [3] },
                { saleId: 13, buyIds: [3, 4] },
                { saleId: 12, buyIds: [4] }
            ]);
});

// factory method to create trades given [date, qty, price] 
function getBuys(rows) {
    return _.map(rows, r => {
        var buy = make.makeBuy.call(null, r[0], 'SOME STOCK', r[1], r[2], '0');
        buy.balance = buy.qty;
        buy.id = id++;
        return buy;
    });
}
function getSales(rows) {
    return _.map(rows, r => {
        var sale = make.makeSale.call(null, r[0], 'SOME STOCK', r[1], r[2], '0');

        sale.id = id++;
        return sale;
    });
}

});