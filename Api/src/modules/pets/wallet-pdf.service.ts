import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { PetsService } from './pets.service';

type Wallet = Awaited<ReturnType<PetsService['getWallet']>>;
type WalletEntry = Wallet['entries'][number];

@Injectable()
export class WalletPdfService {
  /** Renderiza a carteira de vacinação (mesmos dados de `GET /v1/pets/:id/wallet`) como PDF. */
  generate(wallet: Wallet): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.renderHeader(doc, wallet);
      this.renderSummary(doc, wallet);
      this.renderEntries(doc, wallet);

      doc.end();
    });
  }

  private renderHeader(doc: PDFKit.PDFDocument, wallet: Wallet): void {
    doc.fontSize(18).text('Carteira de Vacinação', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Pet: ${wallet.pet.name}`);
    doc.text(`Código público: ${wallet.pet.publicCode}`);
    doc.text(`Espécie: ${wallet.pet.species}`);
    if (wallet.pet.breed) {
      doc.text(`Raça: ${wallet.pet.breed}`);
    }
    if (wallet.pet.birthDate) {
      doc.text(`Nascimento: ${this.formatDate(wallet.pet.birthDate)}`);
    }
    doc.moveDown();
  }

  private renderSummary(doc: PDFKit.PDFDocument, wallet: Wallet): void {
    doc.fontSize(14).text('Resumo');
    doc.fontSize(12);
    doc.text(`Status: ${wallet.summary.status}`);
    doc.text(`Doses aplicadas: ${wallet.summary.totalApplied}`);
    doc.text(`Pendentes: ${wallet.summary.totalPending}`);
    doc.text(`Vencidas: ${wallet.summary.totalOverdue}`);
    doc.moveDown();
  }

  private renderEntries(doc: PDFKit.PDFDocument, wallet: Wallet): void {
    doc.fontSize(14).text('Histórico');
    doc.moveDown(0.5);

    if (wallet.entries.length === 0) {
      doc.fontSize(12).text('Nenhum registro de vacinação até o momento.');
      return;
    }

    wallet.entries.forEach((entry) => {
      this.renderEntry(doc, entry);
      doc.moveDown(0.5);
    });
  }

  private renderEntry(doc: PDFKit.PDFDocument, entry: WalletEntry): void {
    doc.fontSize(12).text(`${entry.vaccine.name} — dose ${entry.doseNumber}`, {
      continued: false,
    });
    doc.fontSize(10);

    if (entry.type === 'vaccination') {
      doc.text(`Aplicada em: ${this.formatDate(entry.appliedAt)}`);
      doc.text(
        `Veterinário: ${entry.veterinarian.fullName} (${entry.veterinarian.crmv})`,
      );
      doc.text(`Clínica: ${entry.clinic.tradeName ?? entry.clinic.cnpj}`);
      doc.text(
        `Lote: ${entry.batchNumber} (validade ${this.formatDate(entry.batchExpiry)})`,
      );
      if (entry.nextDoseAt) {
        doc.text(`Próxima dose: ${this.formatDate(entry.nextDoseAt)}`);
      }
    } else {
      doc.text(`Status: ${entry.status}`);
      if (entry.scheduledAt) {
        doc.text(`Agendada para: ${this.formatDate(entry.scheduledAt)}`);
      }
      doc.text(`Prescrita em: ${this.formatDate(entry.prescribedAt)}`);
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
