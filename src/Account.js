var _ = require('lodash');
var util = require('util');
var BigNumber = require('BigNumber.js');
var simulate = require('./Simulation.js');

BigNumber.config({ DECIMAL_PLACES: 2 });

function create(name) {
    var _nextId = -1,
        _id, _name,
        _holdings = {}, // map of stock to number of units
        _trades = [], _dividends = [];


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
        addDividends(state.dividends);
    }

    function addDividends(divs) {
        _.each(divs, row => {
            var record = Object.create(row);

            record.id = _nextId--;
            _dividends.push(record);

        });
    }
    function register(trades) {
        try {
            _.each(trades, function (trade, index) {
                var thisTrade = Object.create(trade),
                    saleQty,
                    current_holding_qty;

                thisTrade.id = _nextId--;
                _trades.push(thisTrade);
                _holdings[trade.stock] = (_holdings[trade.stock] || 0);

                if (trade.is_buy) {
                    thisTrade.balance = trade.qty;
                    _holdings[trade.stock] += trade.qty;
                } else {

                    saleQty = trade.qty;
                    current_holding_qty = _holdings[trade.stock];
                    if (current_holding_qty < saleQty) {
                        throw new Error(util.format('Insufficient funds to sell %d of %s. Cur Balance=%d', thisTrade.qty, thisTrade.stock, current_holding_qty));
                    }
                    _holdings[trade.stock] = _holdings[trade.stock] - saleQty;
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
        var snapshots = simulate(_trades, _dividends);
        var lastSnapshotKey = _(snapshots).keys().sortBy().last();
        var holdings = snapshots[lastSnapshotKey].holdings;

        return _(holdings).map((trades, stock) => {
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
            .sortBy(['stock']);


    }
    function getAnnualStmts() {
        return simulate(_trades, _dividends);
    }

    function getId() { return _id; }
    function getName() { return _name; }
    return {
        register: register,
        getHoldings: getHoldings,
        getId: getId,
        getName: getName,
        getAnnualStmts: getAnnualStmts,
        addDividends: addDividends,
        __state: { name: _name, trades: _trades, dividends: _dividends }
    };
}

module.exports = {
    create: create
};