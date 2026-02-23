const _ = require('lodash')
const path = require('path')
const sanitize = require('sanitize-filename')
const PDFDocument = require('pdfkit')
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx')
const ExcelJS = require('exceljs')
const PptxGenJS = require('pptxgenjs')
const removeMd = require('remove-markdown')
const cheerio = require('cheerio')

const FOOTER_TEXT = 'TODOS OS CONTEÚDOS SÃO RESTRITO - CONFIDÊNCIAL - USO INTERNO DA TBDC🔴'

function safeFilename (page, ext) {
  const base = sanitize(`${page.localeCode}-${page.path}`.replace(/[\\/]/g, '-')) || `article-${page.id}`
  return `${base}.${ext}`
}

function normalizeText (txt) {
  return String(txt || '')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+$/gm, '')
    .trim()
}

function getArticlePlainText (page) {
  if (page.contentType === 'html') {
    return normalizeText(removeMd(require('striptags')(page.content || '')))
  }
  return normalizeText(removeMd(page.content || ''))
}

function extractSections (page) {
  const titleFallback = page.title || 'Artigo'
  const sections = []

  if (page.contentType === 'html') {
    const $ = cheerio.load(page.content || '')
    let current = { title: titleFallback, lines: [] }
    $('h1,h2,h3,h4,h5,h6,p,li').each((idx, el) => {
      const tag = String(el.tagName || '').toLowerCase()
      const text = normalizeText($(el).text())
      if (!text) return
      if (tag.startsWith('h')) {
        if (current.lines.length > 0 || current.title !== titleFallback) {
          sections.push(current)
        }
        current = { title: text, lines: [] }
      } else {
        current.lines.push(text)
      }
    })
    if (current.lines.length > 0 || sections.length < 1) {
      sections.push(current)
    }
    return sections
  }

  const lines = String(page.content || '').split('\n')
  let current = { title: titleFallback, lines: [] }
  for (const raw of lines) {
    const ln = raw.trim()
    if (!ln) continue
    const heading = ln.match(/^#{1,6}\s+(.+)$/)
    if (heading) {
      if (current.lines.length > 0 || current.title !== titleFallback) {
        sections.push(current)
      }
      current = { title: normalizeText(removeMd(heading[1])), lines: [] }
    } else {
      current.lines.push(normalizeText(removeMd(ln)))
    }
  }
  if (current.lines.length > 0 || sections.length < 1) {
    sections.push(current)
  }
  return sections
}

function slideFooter (slide) {
  slide.addShape('rect', {
    x: 0,
    y: 6.9,
    w: 13.33,
    h: 0.6,
    fill: { color: '1A1A1A' },
    line: { color: '1A1A1A' }
  })
  slide.addText(FOOTER_TEXT, {
    x: 0.3,
    y: 7.05,
    w: 12.7,
    h: 0.3,
    fontFace: 'Arial',
    color: 'FFFFFF',
    fontSize: 9,
    align: 'center'
  })
}

async function generatePdf (page) {
  const doc = new PDFDocument({ margin: 48, size: 'A4' })
  const chunks = []
  doc.on('data', c => chunks.push(c))

  const writeFooter = () => {
    doc.fontSize(8).fillColor('#666666')
    doc.text(FOOTER_TEXT, 48, doc.page.height - 46, { width: doc.page.width - 96, align: 'center' })
  }
  doc.on('pageAdded', writeFooter)

  doc.rect(0, 0, doc.page.width, 130).fill('#0B3D91')
  doc.fillColor('#FFFFFF').fontSize(30).text('TBDC', 48, 38)
  doc.fontSize(12).text('Apresentacao de Conteudo Interno', 48, 82)
  doc.moveDown(2)

  doc.fillColor('#111111').fontSize(22).text(page.title || 'Artigo', { width: 500 })
  doc.moveDown(0.5)
  doc.fontSize(11).fillColor('#333333')
  doc.text(`Criado em: ${page.createdAt || '-'}`)
  doc.text(`Atualizado em: ${page.updatedAt || '-'}`)
  doc.text(`Criador: ${page.creatorName || '-'}`)
  doc.text(`Ultima alteracao por: ${page.authorName || '-'}`)
  doc.moveDown(1.2)

  doc.fillColor('#222222').fontSize(12)
  getArticlePlainText(page).split('\n').forEach(ln => {
    if (ln.trim()) {
      doc.text(ln, { width: 500 })
    }
  })
  writeFooter()
  doc.end()
  return await new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

async function generateCsv (page) {
  const body = getArticlePlainText(page).replace(/"/g, '""')
  const rows = [
    ['Campo', 'Valor'],
    ['Titulo', page.title || ''],
    ['Caminho', `/${page.localeCode}/${page.path}`],
    ['CriadoEm', page.createdAt || ''],
    ['AtualizadoEm', page.updatedAt || ''],
    ['Criador', page.creatorName || ''],
    ['UltimaAlteracaoPor', page.authorName || ''],
    ['Conteudo', body],
    ['Aviso', FOOTER_TEXT]
  ]
  const csv = rows.map(r => `"${String(r[0]).replace(/"/g, '""')}","${String(r[1]).replace(/"/g, '""')}"`).join('\n')
  return Buffer.from(csv, 'utf8')
}

async function generateXlsx (page) {
  const wb = new ExcelJS.Workbook()
  const meta = wb.addWorksheet('Resumo')
  meta.columns = [{ header: 'Campo', key: 'field', width: 26 }, { header: 'Valor', key: 'value', width: 90 }]
  meta.addRows([
    { field: 'Titulo', value: page.title || '' },
    { field: 'Caminho', value: `/${page.localeCode}/${page.path}` },
    { field: 'CriadoEm', value: page.createdAt || '' },
    { field: 'AtualizadoEm', value: page.updatedAt || '' },
    { field: 'Criador', value: page.creatorName || '' },
    { field: 'UltimaAlteracaoPor', value: page.authorName || '' },
    { field: 'Aviso', value: FOOTER_TEXT }
  ])
  meta.getRow(1).font = { bold: true }

  const content = wb.addWorksheet('Conteudo')
  content.columns = [{ header: 'Linha', key: 'lineNo', width: 10 }, { header: 'Texto', key: 'text', width: 120 }]
  const lines = getArticlePlainText(page).split('\n').filter(Boolean)
  lines.forEach((ln, i) => content.addRow({ lineNo: i + 1, text: ln }))
  content.getRow(1).font = { bold: true }

  return await wb.xlsx.writeBuffer()
}

async function generateDocx (page) {
  const children = [
    new Paragraph({
      text: 'TBDC',
      heading: HeadingLevel.TITLE
    }),
    new Paragraph({
      children: [new TextRun({ text: page.title || 'Artigo', bold: true, size: 38 })]
    }),
    new Paragraph(`Criado em: ${page.createdAt || '-'}`),
    new Paragraph(`Atualizado em: ${page.updatedAt || '-'}`),
    new Paragraph(`Criador: ${page.creatorName || '-'}`),
    new Paragraph(`Ultima alteracao por: ${page.authorName || '-'}`),
    new Paragraph('')
  ]

  getArticlePlainText(page).split('\n').forEach(ln => {
    if (ln.trim()) {
      children.push(new Paragraph(ln))
    }
  })

  children.push(new Paragraph(''))
  children.push(new Paragraph({
    children: [new TextRun({ text: FOOTER_TEXT, bold: true })]
  }))

  const doc = new Document({
    sections: [{
      properties: {},
      children
    }]
  })
  return await Packer.toBuffer(doc)
}

async function generatePptx (page) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'TBDC'
  pptx.company = 'TBDC'
  pptx.subject = page.title || 'Artigo'
  pptx.title = `Apresentacao - ${page.title || 'Artigo'}`

  const cover = pptx.addSlide()
  cover.background = { color: '0E1A2B' }
  cover.addShape('rect', { x: 0, y: 0, w: 13.33, h: 1.3, fill: { color: 'D32F2F' }, line: { color: 'D32F2F' } })
  cover.addText('TBDC', { x: 0.5, y: 0.2, w: 4, h: 0.6, color: 'FFFFFF', fontFace: 'Arial Black', fontSize: 28, bold: true })
  cover.addText(page.title || 'Artigo', { x: 0.7, y: 1.8, w: 12, h: 1.2, color: 'FFFFFF', fontFace: 'Calibri', fontSize: 34, bold: true })
  cover.addText('Apresentacao automatica do artigo', { x: 0.7, y: 3.1, w: 11.8, h: 0.6, color: 'DCE3EE', fontFace: 'Calibri', fontSize: 18 })
  cover.addText(`Criado em: ${page.createdAt || '-'}\nAtualizado em: ${page.updatedAt || '-'}\nCriador: ${page.creatorName || '-'}\nUltima alteracao por: ${page.authorName || '-'}`, {
    x: 0.9, y: 4.1, w: 7.5, h: 2.0, color: 'FFFFFF', fontFace: 'Calibri', fontSize: 14, valign: 'top'
  })
  cover.addShape('rect', { x: 9.2, y: 3.7, w: 3.2, h: 2.3, fill: { color: '1E2A3D' }, line: { color: 'D32F2F', pt: 1.2 } })
  cover.addText(`/${page.localeCode}/${page.path}`, { x: 9.35, y: 4.5, w: 2.9, h: 1.0, color: 'FFFFFF', fontFace: 'Consolas', fontSize: 11, align: 'center', valign: 'mid' })
  slideFooter(cover)

  const sections = extractSections(page)
  sections.forEach(sec => {
    const blocks = _.chunk(sec.lines, 8)
    if (blocks.length < 1) {
      blocks.push([])
    }
    blocks.forEach((chunkLines, idx) => {
      const slide = pptx.addSlide()
      slide.background = { color: 'F4F6FA' }
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: '0E1A2B' }, line: { color: '0E1A2B' } })
      slide.addText(sec.title || page.title || 'Secao', {
        x: 0.6, y: 0.2, w: 12.1, h: 0.4, color: 'FFFFFF', fontFace: 'Calibri', fontSize: 20, bold: true
      })
      if (idx > 0) {
        slide.addText(`Continua (${idx + 1})`, { x: 11.3, y: 0.23, w: 1.7, h: 0.3, color: 'FFCDD2', fontFace: 'Calibri', fontSize: 10, align: 'right' })
      }
      const bulletText = chunkLines.length > 0 ? chunkLines.map(l => `• ${l}`).join('\n') : '• (Sem conteudo textual nesta secao)'
      slide.addText(bulletText, {
        x: 0.8,
        y: 1.25,
        w: 11.9,
        h: 5.2,
        color: '263238',
        fontFace: 'Calibri',
        fontSize: 18,
        valign: 'top',
        breakLine: true
      })
      slideFooter(slide)
    })
  })

  return await pptx.write('nodebuffer')
}

async function generate (format, page) {
  const fmt = _.toLower(format)
  switch (fmt) {
    case 'pdf':
      return {
        mime: 'application/pdf',
        fileName: safeFilename(page, 'pdf'),
        buffer: await generatePdf(page)
      }
    case 'csv':
      return {
        mime: 'text/csv; charset=utf-8',
        fileName: safeFilename(page, 'csv'),
        buffer: await generateCsv(page)
      }
    case 'xlsx':
    case 'slsx':
      return {
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: safeFilename(page, 'xlsx'),
        buffer: await generateXlsx(page)
      }
    case 'docx':
      return {
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: safeFilename(page, 'docx'),
        buffer: await generateDocx(page)
      }
    case 'pptx':
      return {
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        fileName: safeFilename(page, 'pptx'),
        buffer: await generatePptx(page)
      }
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}

module.exports = {
  FOOTER_TEXT,
  generate
}
