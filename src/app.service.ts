import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';

@Injectable()
export class AppService {

  generateReport(body: any, res: Response) {
    const { totalEfectivo, salidas } = body;
    const pdfPath = path.join(__dirname, '..', 'uploads', 'report.pdf');
    const doc = new PDFDocument({
      size: [198, 841],
      margin: 10
    });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    const formattedTotalEfectivo = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(totalEfectivo);


    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    const logoWidth = 150;  
    doc.image(logoPath, (doc.page.width - logoWidth) / 2, -15, { width: logoWidth });
    
    doc.font('Helvetica-Bold');
    
    doc.moveDown(3);
    doc.fontSize(12).text('Cierre de caja', { align: 'center'});

    doc.moveDown(1);
    
    // Crear un objeto Date con la hora actual
    const now = new Date();
    
    // Restar 3 horas (3 * 60 * 60 * 1000 milisegundos)
    now.setHours(now.getHours() - 3);
    
    // Formatear la fecha ajustada
    const formattedDate = now.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    doc.fontSize(10).text(`Fecha: ${formattedDate}`, { align: 'center'});

    if (salidas && salidas.length > 0) {
      let totalSalidas = 0;
      salidas.forEach(salida => {
        totalSalidas += salida.monto;
      });

      const totalFinal = totalEfectivo + totalSalidas;
      const formattedTotalFinal = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
      }).format(totalFinal);

      doc.moveDown(4);
      doc.fontSize(11.5).text('Total Efectivo:', {continued: true}).text(`${formattedTotalFinal} `, { align: 'right'});


      doc.moveDown(0.5);
      doc.fontSize(10.5).text('Salidas:');
      salidas.forEach(salida => {
        doc.moveDown(1);
        const formattedMonto = new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS'
        }).format(-salida.monto);
        
        doc.font('Helvetica');
        doc.fontSize(10.5).text(`${salida.descripcion})`, {continued: true});
        doc.font('Helvetica-Bold');
        doc.fontSize(11.5).text(`${formattedMonto}`, { align: 'right'});
      });
      // doc.text('----------------------------------------------', { align: 'center'});
      doc.moveDown(1);
      doc.moveTo(10, doc.y).lineTo(188, doc.y).stroke();
      doc.moveDown(1);
    }

    if (!salidas) doc.moveDown(4);

    doc.fontSize(11.5).text('Total Final:', {continued:true}).text(`${formattedTotalEfectivo} `, { align: 'right'});

    doc.moveDown(4);
    doc.font('Helvetica').fontSize(11);
    doc.text('.......................................................', { align: 'center'});
    doc.text('Firma:', {align: 'center'});
    doc.moveDown(3);
    doc.text('.......................................................', { align: 'center'});
    doc.text('Aclaración:', { align: 'center'});
    doc.moveDown(2);
    doc.end();

    writeStream.on('finish', () => {
      res.sendFile(pdfPath, err => {
        if (err) {
          console.error('Error sending PDF:', err);
          res.status(500).send('Error generating PDF');
        } else {
          fs.unlinkSync(pdfPath); 
        }
      });
    });
  }

  uploadFile(file: Express.Multer.File, res: Response) {
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const createPDF = (ticketData) => {
      const pdfPath = path.join(__dirname, '..', 'uploads', 'transformed.pdf');
      const doc = new PDFDocument({
        size: [198, 841],
        margin: 0
      });
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      doc.font('Courier-Bold');
      doc.fontSize(9);

      const drawBorders = (x, y, width, height) => {
        doc.rect(x, y, width, height).stroke();
      };

      const addDataToPDF = (ticketData) => {
        const rowHeight = 15;
        const colWidths = [98, 50, 50];
        const pageHeight = 841;
        let xPos = 0;
        let yPos = 0;
        for (let i = 0; i < ticketData.length; i++) {
          if (yPos + rowHeight > pageHeight) {
            doc.addPage({ size: [198, pageHeight], margin: 0 });
            yPos = 0;
          }

          xPos = 0;
          for (let j = 0; j < ticketData[i].length; j++) {
            const text = ticketData[i][j] ? ticketData[i][j].toString() : '';
            const options = {
              width: colWidths[j] - 10,
              align: j === 1 && i >= 1 ? 'center' : 'left',
            };

            doc.text(text, xPos + 5, yPos + 5, options);
            drawBorders(xPos, yPos, colWidths[j], rowHeight);

            xPos += colWidths[j];
          }

          yPos += rowHeight;
        }
      };

      addDataToPDF(ticketData);

      doc.end();

      writeStream.on('finish', () => {
        res.sendFile(pdfPath, err => {
          if (err) {
            console.error('Error sending PDF:', err);
            res.status(500).send('Error generating PDF');
          } else {
            fs.unlinkSync(file.path);
            fs.unlinkSync(pdfPath);
          }
        });
      });
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    for (let i = 0; i < data.length; i++) {
      if (typeof data[i][0] === 'string') {
        const match = data[i][0].match(/\[(.*?)\]/);
        data[i][0] = match ? match[1] : '';
      }
    }

    const filteredData = data.slice(4).map(row => [row[0], row[1], '']);
    filteredData.unshift(['CÓDIGO', 'SISTEMA', 'LOCAL']);
    createPDF(filteredData);
  }
}
