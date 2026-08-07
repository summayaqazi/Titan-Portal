const PDFDocument = require('pdfkit');

const BRAND = 'Titan Institute';
const ACCENT = '#4338ca';
const MUTED = '#64748b';
const DARK = '#0f172a';

function streamPdf(res, filename, build) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  build(doc);
  doc.end();
}

function drawHeader(doc, title, subtitle) {
  doc.fillColor(ACCENT).fontSize(20).text(BRAND, { continued: false });
  doc.fillColor(MUTED).fontSize(9).text('IT Institute Management Portal');
  doc.moveDown(0.8);
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.8);
  doc.fillColor(DARK).fontSize(16).text(title);
  if (subtitle) {
    doc.fillColor(MUTED).fontSize(10).text(subtitle);
  }
  doc.moveDown(1);
}

function drawSectionTitle(doc, text) {
  doc.moveDown(0.6);
  doc.fillColor(ACCENT).fontSize(12).text(text);
  doc.fillColor(DARK).fontSize(10);
  doc.moveDown(0.3);
}

function drawKeyValueRows(doc, rows) {
  rows.forEach(([label, value]) => {
    doc
      .fillColor(MUTED)
      .fontSize(10)
      .text(label, 50, doc.y, { continued: true, width: 150 })
      .fillColor(DARK)
      .text(value ?? '—');
  });
}

function drawFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .text(`Generated on ${new Date().toLocaleString()} · ${BRAND}`, 50, 780, {
        align: 'center',
        width: 495,
      });
  }
}

function studentAuditPdf(res, { student, enrollments = [], payments = [] }) {
  const name = student.user?.name || 'Student';
  streamPdf(res, `student-audit-${student._id}.pdf`, (doc) => {
    drawHeader(doc, 'Student Audit Report', `Generated for ${name}`);

    drawSectionTitle(doc, 'Personal Information');
    drawKeyValueRows(doc, [
      ['Full Name', student.user?.name],
      ['Email', student.user?.email],
      ['Phone', student.user?.phone],
      ["Father's Name", student.fatherName],
      ['CNIC', `${student.cnic || '—'}${student.cnicVerified ? ' (Verified)' : ' (Unverified)'}`],
      ['Date of Birth', student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '—'],
      ['Gender', student.gender],
      ['City', student.city?.name],
      ['Address', student.address],
      ['Status', student.isActive ? 'Active' : 'Inactive'],
    ]);

    drawSectionTitle(doc, 'Employment Information');
    drawKeyValueRows(doc, [
      ['Employment Status', student.employmentStatus],
      ['Organization', student.organization],
      ['Designation', student.designation],
      ['Monthly Income', student.monthlyIncome ? `PKR ${Number(student.monthlyIncome).toLocaleString()}` : '—'],
    ]);

    drawSectionTitle(doc, 'Audit Trail');
    drawKeyValueRows(doc, [
      ['Created By', student.createdBy?.name],
      ['Created At', student.createdAt ? new Date(student.createdAt).toLocaleString() : '—'],
      ['Last Updated By', student.updatedBy?.name],
      ['Last Updated At', student.updatedAt ? new Date(student.updatedAt).toLocaleString() : '—'],
    ]);

    drawSectionTitle(doc, `Enrollment History (${enrollments.length})`);
    if (enrollments.length === 0) {
      doc.fillColor(MUTED).fontSize(10).text('No enrollments on record.');
    }
    enrollments.forEach((enr, idx) => {
      doc.fillColor(DARK).fontSize(10.5).text(
        `${idx + 1}. ${enr.course?.name || 'Course'} · ${enr.batch?.batchCode || '—'} · Roll #${enr.rollNumber || '—'}`
      );
      doc
        .fillColor(MUTED)
        .fontSize(9)
        .text(
          `   Status: ${enr.status} · Payment: ${enr.paymentStatus} · Admitted: ${
            enr.admissionDate ? new Date(enr.admissionDate).toLocaleDateString() : '—'
          }`
        );
      doc.moveDown(0.3);
    });

    drawSectionTitle(doc, `Payment History (${payments.length})`);
    if (payments.length === 0) {
      doc.fillColor(MUTED).fontSize(10).text('No payments on record.');
    }
    payments.forEach((p, idx) => {
      doc
        .fillColor(DARK)
        .fontSize(10.5)
        .text(`${idx + 1}. ${p.invoiceNumber || '—'} · PKR ${Number(p.amount).toLocaleString()} · ${p.feeType}`);
      doc
        .fillColor(MUTED)
        .fontSize(9)
        .text(
          `   Status: ${p.status} · Due: ${p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'} · Paid: ${
            p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '—'
          }`
        );
      doc.moveDown(0.3);
    });

    drawFooter(doc);
  });
}

function feeTypeLabel(feeType) {
  return { registration: 'Registration Fee', monthly: 'Monthly Fee', installment: 'Installment' }[feeType] || feeType;
}

function invoicePdf(res, { payment, student, enrollment }) {
  streamPdf(res, `invoice-${payment.invoiceNumber || payment._id}.pdf`, (doc) => {
    drawHeader(doc, 'Invoice', `Invoice # ${payment.invoiceNumber || '—'}`);

    drawSectionTitle(doc, 'Billed To');
    drawKeyValueRows(doc, [
      ['Student', student.user?.name],
      ['Email', student.user?.email],
      ['Course', enrollment?.course?.name],
      ['Batch', enrollment?.batch?.batchCode],
      ['Roll Number', enrollment?.rollNumber],
    ]);

    drawSectionTitle(doc, 'Invoice Details');
    drawKeyValueRows(doc, [
      ['Fee Type', feeTypeLabel(payment.feeType)],
      ['Installment #', payment.installmentNumber],
      ['Amount', `PKR ${Number(payment.amount).toLocaleString()}`],
      ['Due Date', payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : '—'],
      ['Status', payment.status.toUpperCase()],
    ]);

    doc.moveDown(1);
    doc
      .fillColor(ACCENT)
      .fontSize(14)
      .text(`Total Due: PKR ${Number(payment.amount).toLocaleString()}`, { align: 'right' });

    drawFooter(doc);
  });
}

function receiptPdf(res, { payment, student, enrollment }) {
  streamPdf(res, `receipt-${payment.invoiceNumber || payment._id}.pdf`, (doc) => {
    drawHeader(doc, 'Payment Receipt', `Receipt for Invoice # ${payment.invoiceNumber || '—'}`);

    drawSectionTitle(doc, 'Received From');
    drawKeyValueRows(doc, [
      ['Student', student.user?.name],
      ['Email', student.user?.email],
      ['Course', enrollment?.course?.name],
      ['Batch', enrollment?.batch?.batchCode],
    ]);

    drawSectionTitle(doc, 'Payment Details');
    drawKeyValueRows(doc, [
      ['Fee Type', feeTypeLabel(payment.feeType)],
      ['Amount Paid', `PKR ${Number(payment.amount).toLocaleString()}`],
      ['Method', payment.method],
      ['Paid Date', payment.paidDate ? new Date(payment.paidDate).toLocaleDateString() : '—'],
      ['Received By', payment.receivedBy?.name],
      ['Remarks', payment.remarks],
    ]);

    doc.moveDown(1);
    doc.fillColor('#16a34a').fontSize(16).text('PAID', { align: 'right' });

    drawFooter(doc);
  });
}

module.exports = { studentAuditPdf, invoicePdf, receiptPdf };
