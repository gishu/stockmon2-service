var _ = require('lodash');
var buyPicker = require('./BuyPicker.js');
var brokPath = './HdfcBrokerage.js';
var getBrokerage = require(brokPath);
var make = require('./Trade.js');
var moment = require('moment');

// simulation of trades to annual snapshots

// get the Fin Year (Apr-Mar) of the earliest trade
function _getFinYearRange(firstTrade, firstDiv) {
    var date1, date2, earliestDate,
        finYearStart;

    if (firstTrade) { date1 = moment(firstTrade.date); }
    if (firstDiv) { date2 = moment(firstDiv.date); }

    if (date1) {
        if (date2) {
            earliestDate = date1.isBefore(date2) ? date1 : date2;
        } else {
            earliestDate = date1;
        }
    } else {
        earliestDate = date2;
    }

    finYearStart = moment(earliestDate).month(3).startOf('month');
    if (earliestDate.isBefore(finYearStart)) {
        return [moment(finYearStart).subtract({ 'years': 1 }), moment(finYearStart).subtract({ 'days': 1 })];
    } else {
        return [moment(finYearStart), moment(finYearStart).add({ 'years': 1 }).subtract({ 'days': 1 })];
    }
}

function _filterByYear(datedEntries, finYearRange) {
    return _.reject(datedEntries, e => moment(e.date).isBefore(finYearRange[0]) || moment(e.date).isAfter(finYearRange[1]));
}

// process trades of the Year to determine gains,dividends and closing stmt of holdings
function _process(finYearRange, trades, dividends, opening_holdings) {
    var gains = [],
        divs = [],
        holdings = _.cloneDeep(opening_holdings),
        divEntry;

    _.forEach(trades, t => {
        var sale, buy, buyIds;
        holdings[t.stock] = holdings[t.stock] || [];
        if (t.is_buy) {
            buy = Object.create(t);
            buy.balance = t.qty;
            holdings[t.stock].push(buy);
        }
        else {
            sale = Object.create(t);
            buyIds = buyPicker(holdings[sale.stock], sale);

            _.each(buyIds, function (id) {
                var buy = _.find(holdings[sale.stock], { id: id });
                var qty = _.min([sale.qty, buy.balance]);
                var buyBrokerage = getBrokerage(sale.qty, buy.price, buy.is_buy);
                gains.push(make.makeGain(sale.date, sale.stock, qty, buy.id, buy.price, sale.id, sale.price, buyBrokerage.plus(sale.brokerage)));
                buy.balance -= qty;
                if (buy.balance === 0) {
                    _.remove(holdings[sale.stock], { id: id });
                }
            });
        }
    });

    return {
        year: finYearRange[0].year(),
        gains: gains,
        dividends: dividends,
        holdings: holdings
    };
}

module.exports = function (openingHoldings, tradeStream, dividendStream, callback) {
    try {
        var holdings = _.cloneDeep(openingHoldings),
            snapshots = [],
            finYearRange = _getFinYearRange(tradeStream[0], dividendStream[0]),
            tradesInFinYear = _filterByYear(tradeStream, finYearRange),
            divviesInFinYear = _filterByYear(dividendStream, finYearRange),
            curSnapShot;

        while (tradesInFinYear.length > 0 || divviesInFinYear.length > 0) {
            curSnapShot = _process(finYearRange, tradesInFinYear, divviesInFinYear, holdings);
            snapshots.push(curSnapShot);

            // incr finYear, turn closing stmt of prev year (holdings) into opening for next
            finYearRange = [finYearRange[0].add({ 'years': 1 }), finYearRange[1].add({ 'years': 1 })];
            tradesInFinYear = _filterByYear(tradeStream, finYearRange);
            divviesInFinYear = _filterByYear(dividendStream, finYearRange);
            holdings = curSnapShot.holdings;
        }
        callback(null, snapshots);
    } catch (err) {
        callback(err, null);
    }
};