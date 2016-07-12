var _ = require('lodash'),
    moment = require('moment');

function descPriceComparer(left, right) { return right.price.comparedTo(left.price); }
function ascPriceComparer(left, right) { return left.price.comparedTo(right.price); }



module.exports = function (buys, sales) {
    var buysQueue = _.cloneDeep(buys);
    var salesQueue = _.cloneDeep(sales);
    var matchedTrades = [];

    function getBuysBefore(saleDate) {
        return _.filter(buysQueue, b => b.date.isBefore(saleDate) && b.balance > 0);
    }
    function sortWithSecretSauce(buys, sale) {
        // all temp vars
        var bins, longTermBuys, shortTermBuys,
            longTermLosses, longTermGains, shortTermLosses, shortTermGains,
            oneYearBeforeSale = moment(sale.date).subtract(1, 'year');

        bins = _.partition(buys, b => b.date.isSameOrBefore(oneYearBeforeSale));

        longTermBuys = bins[0].sort(ascPriceComparer); // max LT Gain / min LT Loss as case may be
        shortTermBuys = bins[1];

        bins = _.partition(longTermBuys, b => b.price.greaterThan(sale.price));
        longTermGains = bins[1];
        longTermLosses = bins[0];

        bins = _.partition(shortTermBuys, b => b.price.greaterThan(sale.price));
        shortTermGains = bins[1].sort(descPriceComparer); // min ST Gains to reduce tax
        shortTermLosses = bins[0].sort(ascPriceComparer); // min ST Loss to reduce loss

        // preferred order
        return _.concat(longTermGains, shortTermLosses, shortTermGains, longTermLosses);

    }
    function matchSale(sale) {
        var buys = getBuysBefore(sale.date),
            saleQty,
            buy, looper = 0, qty, match;

        buys = sortWithSecretSauce(buys, sale);

        saleQty = sale.qty;

        while ((saleQty > 0) && (looper < buys.length)) {
            buy = buys[looper];
            qty = _.min([buy.balance, saleQty]);

            buy.balance -= qty;
            saleQty -= qty;
            looper++;

            match = _.find(matchedTrades, { 'saleId': sale.id });
            if (!match) {
                matchedTrades.push({ 'saleId': sale.id, 'buyIds': [buy.id] });
            } else {
                match.buyIds.push(buy.id);
            }

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

