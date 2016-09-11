var _ = require('lodash');
var moment = require('moment');

var match = require('./BuyPicker.js');
var make = require('./Trade.js');
var makeNew = require('./Snapshot.js');

var log = require('debug')('simulate');


// simulation of trades to annual snapshots

module.exports = function (openingHoldings, tradeStream, dividendStream, brokerageFunc, callback) {
    var getBrokerage = brokerageFunc,

        trades = _.cloneDeep(tradeStream),
        divvies = dividendStream;

    function simulate() {
        try {
            var snapshots = [],
                holdings = _.cloneDeep(openingHoldings),
                finYearRange = _getFinYearRange(trades[0], divvies[0]),
                tradesInFinYear = _filterByYear(trades, finYearRange),
                divviesInFinYear = _filterByYear(dividendStream, finYearRange),
                totalItems = trades.length + dividendStream.length,
                itemsProcessed = 0,
                curSnapShot;

            while (itemsProcessed < totalItems) {
                curSnapShot = _process(finYearRange, tradesInFinYear, divviesInFinYear, holdings);
                snapshots.push(curSnapShot);

                // incr finYear, turn closing stmt of prev year (holdings) into opening for next
                itemsProcessed += (tradesInFinYear.length + divviesInFinYear.length);
                finYearRange = [finYearRange[0].add({ 'years': 1 }), finYearRange[1].add({ 'years': 1 })];
                tradesInFinYear = _filterByYear(trades, finYearRange);
                divviesInFinYear = _filterByYear(dividendStream, finYearRange);
                holdings = curSnapShot.holdings();
            }

            callback(null, makeNew.snapshots(snapshots));
        } catch (err) {
            log(err);
            callback(err, null);
        }
    }

    // process trades of the Year to determine gains,dividends and closing stmt of holdings

    function _process(finYearRange, trades, dividends, opening_holdings) {
        var gains = [],
            divs = [],
            holdings = _.cloneDeep(opening_holdings), // we are going to mutate this one
            mapSales = {},
            divEntry;

        _.forEach(trades, t => {
            var sale, buy;
            holdings[t.stock] = holdings[t.stock] || [];
            if (t.is_buy) {
                buy = t;
                holdings[buy.stock].push(buy);
            }
            else {
                sale = t;
                mapSales[sale.stock] = mapSales[sale.stock] || [];
                mapSales[sale.stock].push(sale);
            }
        });

        _.forOwn(mapSales, (sales, stock) => {
            var matchedTrades = match(holdings[stock], sales);
            _.each(matchedTrades, match => {
                var sale = _.find(sales, { id: match.saleId }),
                    saleQty = sale.qty,
                    saleDate = sale.date;


                _.each(match.buyIds, id => {
                    var buy = _.find(holdings[sale.stock], { id: id }),
                        qty = _.min([saleQty, buy.balance]),
                        brokerage,
                        isShortTerm = false;

                    var days = saleDate.diff(buy.date, 'days');
                    if (days < 0) {
                        throw new Error(util.format("Buy %d date %s is matched with Sale %d dated %s - SERIOUS ERROR! ",
                            buy.id, buy.date.toISOString(), sale.id, sale.date.toISOString()));
                    }

                    isShortTerm = (days < 365);

                    brokerage = getBrokerage(qty, buy.price, true).plus(getBrokerage(qty, sale.price, false));
                    gains.push(make.makeGain(sale.date, sale.stock, qty, buy.id, buy.price, sale.id, sale.price, brokerage, isShortTerm));
                    buy.balance -= qty;
                    saleQty -= qty;
                    if (buy.balance === 0) {
                        _.remove(holdings[sale.stock], { id: id });
                    }
                })

            });
        });

        return makeNew.snapshot(finYearRange[0].year(), gains, dividends, holdings);

    }

    // get the Fin Year (Apr-Mar) of the earliest trade
    function _getFinYearRange(firstTrade, firstDiv) {
        var date1, date2, earliestDate,
            finYearStart;

        if (firstTrade) { date1 = firstTrade.date; }
        if (firstDiv) { date2 = firstDiv.date; }

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
        return _.reject(datedEntries, e => e.date.isBefore(finYearRange[0]) || e.date.isAfter(finYearRange[1]));
    }

    simulate();
};