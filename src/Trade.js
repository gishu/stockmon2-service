var BigNumber = require('bignumber.js');
var moment = require('moment');
var _ = require('lodash');


function makeTrade(date, stock, qty, price, is_buy, notes) {
    var parsedPrice = parseToBigNumber(price);

    return {
        'date': parseDate(date),
        'stock': _.toUpper(stock),
        'qty': qty,
        'is_buy': is_buy,
        'price': parsedPrice,
        'notes': notes || ''
    };
}
function makeBuy(date, stock, qty, price, notes) {
    return makeTrade(date, stock, qty, price, true, notes);
}
function makeSale(date, stock, qty, price, notes) {
    return makeTrade(date, stock, qty, price, false, notes);
}

function parseDate(date) {
    return (moment.isMoment(date) ? date : moment(date));
}

function parseToBigNumber(value) {
    if (typeof (value) === 'string') {
        return new BigNumber(value);
    }
    return value;
}

function makeGain(date, stock, qty, buyId, buy_price, saleId, sell_price, brokerage_amt, isShortTerm) {

    var cp = parseToBigNumber(buy_price),
        sp = parseToBigNumber(sell_price),
        brokerage = parseToBigNumber(brokerage_amt);

    return {
        'date': parseDate(date),
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
        'date': parseDate(date),
        'stock': _.toUpper(stock),
        'amount': parseToBigNumber(amount),
        'notes': notes || ''
    };
}
function loadBuy(row) {
    var buy = makeBuy(moment(row.Date).toDate(), row.Stock, row.Qty, row.Price, row.Notes);
    buy.id = row.Id;
    buy.brokerage = parseToBigNumber(row.Brokerage);
    return buy;
}
function loadSale(row) {
    var sale = makeSale(moment(row.Date), row.Stock, row.Qty, row.Price, row.Notes);
    sale.id = row.Id;
    sale.brokerage = parseToBigNumber(row.Brokerage);
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