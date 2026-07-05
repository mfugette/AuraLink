import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { PartSearchResult } from '../models/part.model';
import { environment } from '../../environments/environment';

export interface NotificationPayload {
  recipient: string;
  type: 'sms' | 'email';
  items: PartSearchResult[];
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiBase = environment.apiUrl;

  constructor(private http: HttpClient) {}

  send(payload: NotificationPayload): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiBase}/api/notify`,
      payload
    );
  }

  buildShoppingList(items: PartSearchResult[]): string {
    const selected = items.filter(i => i.selected);
    if (!selected.length) return '';
    const lines = selected.map(
      i =>
        `• ${i.part.name} (${i.part.partNumber}) - $${i.part.price.toFixed(2)}\n  @ ${i.part.store.name} - ${i.part.store.address}`
    );
    const total = selected.reduce((sum, i) => sum + i.part.price, 0);
    return `AuraLink Parts List\n${'─'.repeat(30)}\n${lines.join('\n')}\n${'─'.repeat(30)}\nEstimated Total: $${total.toFixed(2)}`;
  }

  copyToClipboard(text: string): Promise<void> {
    return navigator.clipboard.writeText(text);
  }

  openSmsLink(phone: string, text: string): void {
    const encoded = encodeURIComponent(text);
    window.location.href = `sms:${phone}?body=${encoded}`;
  }
}
