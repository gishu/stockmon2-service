var _ = require('lodash'),
    moment = require('moment');

function descPriceComparer(left, right) { return right.price.comparedTo(left.price); }
function ascPriceComparer(left, right) { return left.price.comparedTo(right.price); }



module.exports = function (buys, sales) {
    var buysQueue = _.cloneDeep(buys);
    var salesQueue = _.cloneDeep(sales);
    var matchedTrades = {};

    function getBuysBefore(saleDate) {
        return _.filter(buysQueue, b => b.date.isBefore(saleDate) && b.balance > 0);
    }
    function matchSale(sale) {
        var buys = getBuysBefore(sale.date),
            oneYearBeforeSale = moment(sale.date).subtract(1, 'year'),
            groups, longTermBuys, shortTermBuys,
            saleQty,
            buy, looper = 0, qty;

        groups = _.partition(buys, b => b.date.isSameOrBefore(oneYearBeforeSale));
        longTermBuys = groups[0].sort(ascPriceComparer);
        shortTermBuys = groups[1].sort(descPriceComparer);

        buys = _.concat(longTermBuys, shortTermBuys);

        saleQty = sale.qty;

        while ((saleQty > 0) && (looper < buys.length)) {
            buy = buys[looper];
            qty = _.min([buy.balance, saleQty]);

            buy.balance -= qty;
            saleQty -= qty;
            looper++;

            matchedTrades[sale.id] = matchedTrades[sale.id] || [];
            matchedTrades[sale.id].push(buy.id);
        }
        if (saleQty > 0) {
            throw new Error('Insufficient holdings!');
        }
    }

    function getSplice() {
        var looper = 0;
        var totalSold = 0;
        for (looper = 0; looper < salesQueue.length; looper++) {
            var sale = salesQueue[looper];
            totalSold += sale.qty;
            var totalAvailable = _.reduce(getBuysBefore(sale.date), (totalAvailable, buy) => totalAvailable + buy.balance, 0);
            if (totalAvailable < (totalSold * 2)) {
                break;
            }
        }
        return salesQueue.splice(0, looper + 1);
    }

    function matchTrades() {
        while (salesQueue.length > 0) {
            var chunk = getSplice();
            chunk.sort(descPriceComparer);
            _.each(chunk, sale => {
                matchSale(sale, true);
            })
        }
        return matchedTrades;
    }
    return matchTrades();

}

