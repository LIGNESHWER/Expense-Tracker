const express = require('express');
const PDFDocument = require('pdfkit');
const { buildReport } = require('../utils/reportService');
const { sanitizeText } = require('../utils/validationHelpers');

const router = express.Router();

function parseFilters(query = {}) {
  return {
    startDate: query.startDate || '',
    endDate: query.endDate || '',
    category: query.category || '',
  };
}

function buildQueryString(filters) {
  const params = new URLSearchParams();

  if (filters.startDate) {
    params.append('startDate', filters.startDate);
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate);
  }
  if (filters.category) {
    params.append('category', filters.category);
  }

  return params.toString();
}

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) {
    return '';
  }
  return new Date(value).toISOString().slice(0, 10);
}

function buildCsv(report) {
  const escapeCsv = (value) => {
    const stringValue = value === null || value === undefined ? '' : String(value);
    const escaped = stringValue.replace(/"/g, '""');
    return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
  };

  const lines = [];

  lines.push('Expense Tracker Report');
  lines.push(`Date Range,${report.filters.displayRange}`);
  if (report.filters.category) {
    lines.push(`Category,${report.filters.category}`);
  }
  lines.push('');

  lines.push('Summary');
  lines.push('Total Income,Total Expense,Net,Transaction Count');
  lines.push(
    `${report.summary.totalIncome.toFixed(2)},${report.summary.totalExpense.toFixed(2)},${report.summary.net.toFixed(2)},${report.summary.transactionCount}`,
  );
  lines.push('');

  if (report.monthly.length) {
    lines.push('Monthly Summary');
    lines.push('Month,Income,Expense,Net');
    report.monthly.forEach((entry) => {
      lines.push(
        `${entry.label},${entry.income.toFixed(2)},${entry.expense.toFixed(2)},${entry.net.toFixed(2)}`,
      );
    });
    lines.push('');
  }

  if (report.yearly.length) {
    lines.push('Yearly Summary');
    lines.push('Year,Income,Expense,Net');
    report.yearly.forEach((entry) => {
      lines.push(
        `${entry.label},${entry.income.toFixed(2)},${entry.expense.toFixed(2)},${entry.net.toFixed(2)}`,
      );
    });
    lines.push('');
  }

  lines.push('Transactions');
  lines.push('Date,Type,Category,Description,Amount');
  report.transactions.forEach((transaction) => {
    lines.push(
  `${formatDate(transaction.date)},${transaction.type},${escapeCsv(sanitizeText(transaction.category || ''))},${escapeCsv(sanitizeText(transaction.description || ''))},${Number(transaction.amount || 0).toFixed(2)}`,
    );
  });

  return lines.join('\r\n');
}

function renderPdf(res, report) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const timestamp = new Date().toLocaleString();
  const maxTransactions = 50;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="expense-report.pdf"');

  doc.on('error', (error) => {
    console.error('PDF generation failed', error);
    res.status(500).end();
  });

  doc.pipe(res);

  doc.fontSize(20).text('Expense Tracker Report', { align: 'center' });
  doc.moveDown(0.75);
  doc.fontSize(10).fillColor('#555555').text(`Generated on ${timestamp}`, { align: 'center' });
  doc.moveDown(1);
  doc.fillColor('#000000').fontSize(12);

  doc.text(`Date range: ${report.filters.displayRange}`);
  if (report.filters.category) {
    doc.text(`Category filter: ${report.filters.category}`);
  }
  doc.moveDown(1);

  doc.fontSize(14).text('Summary', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`Total Income: ${formatCurrency(report.summary.totalIncome)}`);
  doc.text(`Total Expense: ${formatCurrency(report.summary.totalExpense)}`);
  doc.text(`Net: ${formatCurrency(report.summary.net)}`);
  doc.text(`Transactions: ${report.summary.transactionCount}`);
  doc.moveDown(1);

  doc.fontSize(14).text('Monthly Summary', { underline: true });
  doc.moveDown(0.5);
  if (!report.monthly.length) {
    doc.fontSize(12).text('No monthly data for the selected filters.');
  } else {
    report.monthly.slice(0, 24).forEach((entry) => {
      doc.fontSize(12).text(
        `${entry.label}: Income ${formatCurrency(entry.income)} | Expense ${formatCurrency(entry.expense)} | Net ${formatCurrency(entry.net)}`,
      );
    });
  }
  doc.moveDown(1);

  doc.fontSize(14).text('Yearly Summary', { underline: true });
  doc.moveDown(0.5);
  if (!report.yearly.length) {
    doc.fontSize(12).text('No yearly data for the selected filters.');
  } else {
    report.yearly.forEach((entry) => {
      doc.fontSize(12).text(
        `${entry.label}: Income ${formatCurrency(entry.income)} | Expense ${formatCurrency(entry.expense)} | Net ${formatCurrency(entry.net)}`,
      );
    });
  }
  doc.moveDown(1);

  doc.fontSize(14).text('Transactions', { underline: true });
  doc.moveDown(0.5);
  if (!report.transactions.length) {
    doc.fontSize(12).text('No transactions for the selected filters.');
  } else {
    doc.fontSize(11);
    report.transactions.slice(0, maxTransactions).forEach((transaction) => {
      const date = formatDate(transaction.date);
      const category = sanitizeText(transaction.category || 'Uncategorized') || 'Uncategorized';
      const description = sanitizeText(transaction.description || '');

      doc.text(
        `${date} | ${transaction.type.toUpperCase()} | ${category} | ${formatCurrency(transaction.amount)}`,
      );
      if (description) {
        doc.fontSize(10).fillColor('#555555').text(`   ${description}`);
        doc.fontSize(11).fillColor('#000000');
      }
      doc.moveDown(0.5);
    });

    if (report.transactions.length > maxTransactions) {
      doc.fontSize(10).fillColor('#555555').text(`(Showing first ${maxTransactions} transactions)`);
      doc.fillColor('#000000');
    }
  }

  doc.end();
}

router.get('/', async (req, res, next) => {
  try {
    const queryFilters = parseFilters(req.query);
    const report = await buildReport(req.session.user.id, queryFilters);
    const queryString = buildQueryString(report.filters);
    const querySuffix = queryString ? `&${queryString}` : '';

    return res.render('reports', {
      user: req.session.user,
      report,
      querySuffix,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const queryFilters = parseFilters(req.query);
    const report = await buildReport(req.session.user.id, queryFilters);
    const format = (req.query.format || 'pdf').toLowerCase();

    if (format === 'csv') {
      const csv = buildCsv(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="expense-report.csv"');
      return res.send(csv);
    }

    renderPdf(res, report);
    return null;
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
