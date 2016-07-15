var _ = require('lodash');
var util = require('util');
var BigNumber = require('bignumber.js');
var simulate = require('./Simulation.js');
var log = require('debug')('account');

BigNumber.config({ DECIMAL_PLACES: 2 });

function create(name, broker) {
    var _nextId = -1,
        _id,
        _name, _broker,
        _holdings = {},
        _mapStockToQty = {}, // map of stock to number of units
        _trades = [], _dividends = [];


    if (_.isPlainObject(name)) {
        __loadFromState(name);
    } else {
        _id = _nextId--;
        _name = name;
        _broker = broker;
    }

    function __loadFromState(state) {
        _id = state.id;
        _name = state.name;
        _broker = state.broker;
        _holdings = _.cloneDeep(state.holdings);
        _mapStockToQty = _.reduce(_holdings,
            (register, trades, stock) => {
                register[stock] = _.reduce(trades, (sum, t) => sum + t.qty, 0);
                return register;
            },
            {});
        register(state.trades);
        addDividends(state.dividends);
    }

    function addDividends(divs) {
        _.each(divs, row => {
            var record = Object.create(row);

            record.id = record.id || _nextId--;
            _dividends.push(record);

        });
    }
    function register(trades) {
        try {
            _.each(trades, function (trade, index) {
                var thisTrade = Object.create(trade),
                    saleQty,
                    current_holding_qty;

                thisTrade.id = thisTrade.id || _nextId--;
                _trades.push(thisTrade);
                _mapStockToQty[trade.stock] = _mapStockToQty[trade.stock] || 0;

                if (trade.is_buy) {
                    thisTrade.balance = trade.qty;

                    _mapStockToQty[trade.stock] += trade.qty;
                } else {

                    saleQty = trade.qty;
                    current_holding_qty = _mapStockToQty[trade.stock];
                    if (current_holding_qty < saleQty) {
                        throw new Error(util.format('Insufficient funds to sell %d of %s. Cur Balance=%d', thisTrade.qty, thisTrade.stock, current_holding_qty));
                    }
                    _mapStockToQty[trade.stock] -= saleQty;
                }
            });
        }
        catch (e) {
            log(e);
            throw e;
        }
    }

    function average(qty1, price1, qty2, price2) {
        var temp = price1.mul(qty1).plus(price2.mul(qty2));
        return temp.div(qty1 + qty2);
    }

    function getHoldings(callback) {
        simulate(_holdings, _trades, _dividends, (err, snapshots) => {
            if (err) {
                log('Simulation failed with ' + err);
                callback(err, null);
            }
            var holdings = _.last(snapshots).holdings();

            holdings = _(holdings).map((trades, stock) => {
                var avg_qty = 0;
                return {
                    stock: stock,
                    qty: _.reduce(trades, (result, t) => result + t.balance, 0),
                    avg_price: _.reduce(trades, (result, t) => {
                        var qty = avg_qty;
                        avg_qty += t.balance;
                        return average(qty, result, t.balance, t.price);
                    }, new BigNumber(0))
                }
            })
                .reject({ qty: 0 })
                .sortBy(['stock'])
                .value();
            callback(null, holdings);
        });
    }
    function getAnnualStmts(callback) {
        return simulate(_holdings, _trades, _dividends, callback);
    }

    function getId() { return _id; }
    function getName() { return _name; }
    return {
        register: register,
        getHoldings: getHoldings,
        id: getId,
        getName: getName,
        broker: () => _broker,
        getAnnualStmts: getAnnualStmts,
        addDividends: addDividends,
        __state: { id: _id, name: _name, broker: _broker, trades: _trades, dividends: _dividends }
    };
}

module.exports = {
    create: create
};