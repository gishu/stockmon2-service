var parse = require('./util/parse.js');
var moment = require('moment');
var _ = require('lodash');


function makeTrade(date, stock, qty, price, is_buy, brokerage, notes) {
    var parsedPrice = parse.toBigNumber(price), 
        parsedBrokerage = parse.toBigNumber(brokerage);

    return {
        'date': parse.toDate(date),
        'stock': _.toUpper(stock),
        'qty': qty,
        'is_buy': is_buy,
        'price': parsedPrice,
        'brokerage': parsedBrokerage,
        'notes': notes || ''
    };
}
function makeBuy(date, stock, qty, price, brokerage, notes) {
    return makeTrade(date, stock, qty, price, true, brokerage, notes);
}
function makeSale(date, stock, qty, price, brokerage, notes) {
    return makeTrade(date, stock, qty, price, false, brokerage, notes);
}



function makeGain(date, stock, qty, buyId, buy_price, saleId, sell_price, brokerage_amt, isShortTerm) {

    var cp = parse.toBigNumber(buy_price),
        sp = parse.toBigNumber(sell_price),
        brokerage = parse.toBigNumber(brokerage_amt);

    return {
        'date': parse.toDate(date),
        'stock': stock,
        'qty': qty,
        'buyId': buyId,
        'CP': cp,
        'saleId': saleId,
        'SP': sp,
        'brokerage': brokerage,
        'gain': sp.minus(cp).times(qty).minus(brokerage),
        'isShortTerm': isShortTerm
    };
}
function makeDividend(date, stock, amount, notes) {
    return {
        'date': parse.toDate(date),
        'stock': _.toUpper(stock),
        'amount': parse.toBigNumber(amount),
        'notes': notes || ''
    };
}
function loadBuy(row) {
    var buy = makeBuy(moment(row.Date).toDate(), row.Stock, row.Qty, row.Price, row.Brokerage, row.Notes);
    buy.id = row.Id || row.buy_id; // stmts will use their foreign key
    return buy;
}
function loadSale(row) {
    var sale = makeSale(moment(row.Date), row.Stock, row.Qty, row.Price, row.Brokerage, row.Notes);
    sale.id = row.Id;
    return sale;

}
function loadDiv(row) {
    var div = makeDividend(moment(row.Date).toDate(), row.Stock, row.Amount, row.Notes);
    div.id = row.Id;
    return div;
}

module.exports = {
    makeBuy: makeBuy,
    makeSale: makeSale,
    makeDividend: makeDividend,
    makeGain: makeGain,
    loadBuy: loadBuy,
    loadSale: loadSale,
    loadDiv: loadDiv
};