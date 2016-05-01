var _ = require('lodash');
var util = require('util');
var BigNumber = require('BigNumber.js');
var buyPicker = require('./BuyPicker.js');
var make = require('./Trade.js');
BigNumber.config({ DECIMAL_PLACES: 2 });

function create(id, name) {
    var _id = id, _name = name,
        _nextTradeId = 1;
    var _trades = {},
        _gains = [];

    function register(trades) {
        var copyForRevert = _.cloneDeep(_trades);
        try {
            _.each(trades, function (trade) {
                var tradesForStock = _trades[trade.stock] = _trades[trade.stock] || [];

                if (trade.is_buy) {
                    var buy = Object.create(trade);
                    buy.id = _nextTradeId++;
                    buy.balance = trade.qty;

                    _trades[trade.stock].push(buy);
                } else {
                    var sale = trade;
                    var current_holding_qty = _.reduce(tradesForStock, function(result, trade){ return result + trade.balance}, 0); 
                    if (current_holding_qty < sale.qty) {
                        throw new Error(util.format('Insufficient funds to sell %d of %s. Cur Balance=%d', trade.qty, trade.stock, current_holding_qty));
                    }

                    var buyIds = buyPicker(_trades[trade.stock], trade);
                    var saleQty = trade.qty;
                    _.each(buyIds, function (buy_id) {
                        var buy = _.find(_trades[trade.stock], { id: buy_id });
                        var qty = _.min([saleQty, buy.balance]);

                        _gains.push(make.makeGain(trade.date, trade.stock, qty, buy.price, trade.price, '100'));
                        buy.balance -= qty;
                    });
                }
            });
        }
        catch (e) {
            _trades = copyForRevert;
            throw e;
        }
    }

    function average(qty1, price1, qty2, price2) {
        var temp = price1.mul(qty1).plus(price2.mul(qty2));
        return temp.div(qty1 + qty2);
    }

    function getHoldings() {
        var holdings = _.map(_trades, function (trades, stock) {
            
            var avg_qty = 0,
                active_trades = _.reject(trades, {balance: 0});
            return {
                stock: stock,
                qty: _.reduce(active_trades, function (result, trade) { return result + trade.balance }, 0),
                avg_price: _.reduce(active_trades, function (result, trade) { 
                    var qty = avg_qty;
                    avg_qty += trade.balance;
                    return average(qty, result, trade.balance, trade.price); }, new BigNumber(0))
            };
        });
        holdings = _.reject(holdings, {qty: 0});
        return _.sortBy(holdings, ['stock']);
        // var holdings = _.values(_holdings);
        // return _.sortBy(holdings, 'stock');
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
        getGains: getGains
    };
}

module.exports = {
    create: create
};