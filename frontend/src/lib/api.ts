import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log('Request to:', config.url, 'with auth header');
        } else {
          console.log('Request to:', config.url, 'WITHOUT auth header');
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Unauthorized - redirect to login
          this.removeToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      console.log('Getting token:', token ? token.substring(0, 20) + '...' : 'null');
      return token;
    }
    return null;
  }

  private setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  }

  private removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }

  // Auth methods
  async register(email: string, password: string) {
    const response = await this.client.post('/auth/register', { email, password });
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    if (response.data.access_token) {
      this.setToken(response.data.access_token);
      console.log('Token saved:', response.data.access_token.substring(0, 20) + '...');
    }
    return response.data;
  }

  logout() {
    this.removeToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Invoice methods
  async uploadInvoices(files: File[]) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await this.client.post('/invoices/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async processInvoice(invoiceId: number) {
    const response = await this.client.post(`/invoices/${invoiceId}/process`);
    return response.data;
  }

  async getInvoices() {
    const response = await this.client.get('/invoices');
    return response.data;
  }

  async getInvoice(invoiceId: number) {
    const response = await this.client.get(`/invoices/${invoiceId}`);
    return response.data;
  }

  async updateInvoiceData(invoiceId: number, amendedData: any) {
    const response = await this.client.put(`/invoices/${invoiceId}/data`, {
      amended_data: amendedData,
    });
    return response.data;
  }

  getInvoicePdfUrl(invoiceId: number): string {
    const token = this.getToken();
    return `${API_URL}/invoices/${invoiceId}/pdf?token=${token}`;
  }

  async deleteInvoice(invoiceId: number) {
    const response = await this.client.delete(`/invoices/${invoiceId}`);
    return response.data;
  }

  // AI Enhancement APIs
  async searchVendors(query: string) {
    const response = await this.client.get(`/invoices/vendors/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }

  async recordCorrection(invoiceId: number, correction: {
    field_name: string;
    original_value?: string;
    corrected_value: string;
    vendor_name?: string;
  }) {
    const response = await this.client.post(`/invoices/${invoiceId}/corrections`, correction);
    return response.data;
  }

  async getLearningStats() {
    const response = await this.client.get('/invoices/ai/learning-stats');
    return response.data;
  }

  async getExpenseCategories() {
    const response = await this.client.get('/invoices/ai/categories');
    return response.data;
  }

  async getSupportedLanguages() {
    const response = await this.client.get('/invoices/ai/languages');
    return response.data;
  }

  async translateInvoiceData(invoiceData: any, targetLanguage: string) {
    const response = await this.client.post('/invoices/ai/translate', {
      invoice_data: invoiceData,
      target_language: targetLanguage
    });
    return response.data;
  }

  async checkDuplicates(invoiceId: number) {
    const response = await this.client.get(`/invoices/${invoiceId}/duplicates`);
    return response.data;
  }

  // Settings methods
  async getSettings() {
    const response = await this.client.get('/settings');
    return response.data;
  }

  async saveGeminiKey(apiKey: string) {
    const response = await this.client.post('/settings/gemini-key', { api_key: apiKey });
    return response.data;
  }

  async deleteGeminiKey() {
    const response = await this.client.delete('/settings/gemini-key');
    return response.data;
  }

  async getGeminiKey() {
    const response = await this.client.get('/settings/gemini-key');
    return response.data;
  }

  async updatePreferences(preferences: { auto_process?: boolean; email_notifications?: boolean; auto_sync_erp?: boolean }) {
    const response = await this.client.put('/settings/preferences', preferences);
    return response.data;
  }

  async connectGmail(tokens: { access_token: string; refresh_token: string; token_expiry: string; email: string }) {
    const response = await this.client.post('/settings/gmail/connect', tokens);
    return response.data;
  }

  async disconnectGmail() {
    const response = await this.client.delete('/settings/gmail/disconnect');
    return response.data;
  }

  async toggleGmail() {
    const response = await this.client.post('/settings/gmail/toggle');
    return response.data;
  }

  async checkGmailForInvoices() {
    const response = await this.client.post('/settings/gmail/check');
    return response.data;
  }

  // SMTP/IMAP Integration methods
  async getEmailProviders() {
    const response = await this.client.get('/settings/smtp/providers');
    return response.data;
  }

  async testSmtpConnection(config: {
    email: string;
    password: string;
    imap_host: string;
    imap_port: number;
    use_ssl: boolean;
  }) {
    const response = await this.client.post('/settings/smtp/test', config);
    return response.data;
  }

  async connectSmtp(config: {
    email: string;
    password: string;
    imap_host: string;
    imap_port: number;
    smtp_host: string;
    smtp_port: number;
    use_ssl: boolean;
  }) {
    const response = await this.client.post('/settings/smtp/connect', config);
    return response.data;
  }

  async disconnectSmtp() {
    const response = await this.client.delete('/settings/smtp/disconnect');
    return response.data;
  }

  async toggleSmtp() {
    const response = await this.client.post('/settings/smtp/toggle');
    return response.data;
  }

  async checkSmtpForInvoices() {
    const response = await this.client.post('/settings/smtp/check');
    return response.data;
  }

  // ERP Integration methods
  async testIntegration(provider: string, config: any) {
    const response = await this.client.post('/integrations/test', {
      provider,
      config,
    });
    return response.data;
  }

  async getIntegrationsStatus() {
    const response = await this.client.get('/integrations/status');
    return response.data;
  }

  async syncInvoiceToERP(provider: string, config: any, invoiceData: any) {
    const response = await this.client.post('/integrations/sync', {
      provider,
      config,
      invoice_data: invoiceData,
    });
    return response.data;
  }

  async syncBatchToERP(provider: string, config: any, invoices: any[]) {
    const response = await this.client.post('/integrations/sync-batch', {
      provider,
      config,
      invoices,
    });
    return response.data;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const api = new ApiClient();

