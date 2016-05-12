var _ = require('lodash');
var util = require('util');
var BigNumber = require('BigNumber.js');
var buyPicker = require('./BuyPicker.js');
var make = require('./Trade.js');

BigNumber.config({ DECIMAL_PLACES: 2 });

function create(name) {
    var _nextId = -1,
        _id, _name,
        _buys = {},
        _gains = [],
        _trades = [];


    if (_.isPlainObject(name)) {
        __loadFromState(name);
    } else {
        _id = _nextId--;
        _name = name;
    }

    function __loadFromState(state) {
        _id = state.id;
        _name = state.name;
        register(state.trades);
    }

    function register(trades) {
        try {
            _.each(trades, function (trade) {
                var tradesForStock = _buys[trade.stock] = _buys[trade.stock] || [],
                    thisTrade = Object.create(trade),
                    saleQty;

                thisTrade.id = _nextId--;
                _trades.push(thisTrade);

                if (trade.is_buy) {
                    thisTrade.balance = trade.qty;

                    _buys[trade.stock].push(thisTrade);
                } else {
                    saleQty = trade.qty;
                    var current_holding_qty = _.reduce(tradesForStock, function (result, trade) { return result + trade.balance }, 0);
                    if (current_holding_qty < saleQty) {
                        throw new Error(util.format('Insufficient funds to sell %d of %s. Cur Balance=%d', thisTrade.qty, thisTrade.stock, current_holding_qty));
                    }

                    var buyIds = buyPicker(_buys[thisTrade.stock], thisTrade);

                    _.each(buyIds, function (buy_id) {
                        var buy = _.find(_buys[thisTrade.stock], { id: buy_id });
                        var qty = _.min([saleQty, buy.balance]);

                        _gains.push(make.makeGain(thisTrade.date, thisTrade.stock, qty, buy.price, thisTrade.price, buy.brokerage.plus(thisTrade.brokerage)));
                        buy.balance -= qty;
                    });
                }
            });
        }
        catch (e) {
            console.error(e);
            throw e;
        }
    }

    function average(qty1, price1, qty2, price2) {
        var temp = price1.mul(qty1).plus(price2.mul(qty2));
        return temp.div(qty1 + qty2);
    }

    function getHoldings() {
        var holdings = _.map(_buys, function (trades, stock) {

            var avg_qty = 0,
                active_trades = _.reject(trades, { balance: 0 });
            return {
                stock: stock,
                qty: _.reduce(active_trades, function (result, trade) { return result + trade.balance }, 0),
                avg_price: _.reduce(active_trades, function (result, trade) {
                    var qty = avg_qty;
                    avg_qty += trade.balance;
                    return average(qty, result, trade.balance, trade.price);
                }, new BigNumber(0))
            };
        });
        holdings = _.reject(holdings, { qty: 0 });
        return _.sortBy(holdings, ['stock']);
    }

    function getGains() {
        return _gains;
    }

    function getId() { return _id; }
    function getName() { return _name; }
    return {
        register: register,
        getHoldings: getHoldings,
        getId: getId,
        getName: getName,
        getGains: getGains,
        __state: { name: _name, trades: _trades }
    };
}

module.exports = {
    create: create
};