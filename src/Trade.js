var BigNumber = require('bignumber.js');

function makeTrade(date, stock, qty, price, is_buy, brokerage){
    var parsedPrice = parseToBigNumber(price);
    var parsedBrokerage = parseToBigNumber(brokerage);
    return {
        'date': parseDate(date),
        'stock': stock,
        'qty': qty,
        'is_buy': is_buy,
        'price': parsedPrice,
        'brokerage': parsedBrokerage
    };
}
function makeBuy(date, stock, qty, price, brokerage){
    return makeTrade(date, stock, qty, price, true, brokerage);
}
function makeSale(date, stock, qty, price, brokerage){
    return makeTrade(date, stock, qty, price, false, brokerage);
}
function makeDividend(date, stock, amount){
    return {
        'date': parseDate(date),
        'stock': stock,
        'amount': new BigNumber(amount)
    };
}
function parseDate(date){
    return (date instanceof Date ? date: new Date(date));
}

function parseToBigNumber(value){
    if (typeof(value) === 'string'){
        return new BigNumber(value);
    }
    return value;
}

function makeGain(date, stock, qty, buy_price, sell_price, brokerage_amt) {
    
    var cp = parseToBigNumber(buy_price),
        sp = parseToBigNumber(sell_price),
        brokerage = parseToBigNumber(brokerage_amt);
                 
    return {
        'date': parseDate(date),
        'stock': stock,
        'qty': qty,
        'CP': cp,
        'SP': sp,
        'brokerage': brokerage,
        'gain': sp.minus(cp).times(qty).minus(brokerage)
    };
}

module.exports = {
    makeBuy: makeBuy,
    makeSale: makeSale,
    makeDividend: makeDividend,
    makeGain: makeGain 
};