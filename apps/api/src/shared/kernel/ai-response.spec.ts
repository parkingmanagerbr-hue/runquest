import { collectApiKeys, geminiText, openAiText } from './ai-response';

describe('collectApiKeys', () => {
  const from = (map: Record<string, string>) => (name: string) => map[name];

  it('coleta BASE, BASE_2 … na ordem', () => {
    const get = from({ K: 'a', K_2: 'b', K_3: 'c' });
    expect(collectApiKeys(get, 'K', 3)).toEqual(['a', 'b', 'c']);
  });

  it('descarta chaves ausentes e vazias (sem furo na rotação)', () => {
    const get = from({ K: 'a', K_2: '', K_4: 'd' }); // K_3 ausente
    expect(collectApiKeys(get, 'K', 4)).toEqual(['a', 'd']);
  });

  it('nenhuma chave configurada → lista vazia', () => {
    expect(collectApiKeys(from({}), 'K', 6)).toEqual([]);
  });

  it('respeita o limite de contagem', () => {
    const get = from({ K: 'a', K_2: 'b', K_3: 'c' });
    expect(collectApiKeys(get, 'K', 2)).toEqual(['a', 'b']);
  });
});

describe('geminiText', () => {
  it('extrai o texto da primeira candidate', () => {
    expect(geminiText({ candidates: [{ content: { parts: [{ text: 'oi' }] } }] })).toBe('oi');
  });
  it('forma inesperada → string vazia (nunca lança)', () => {
    expect(geminiText({})).toBe('');
    expect(geminiText(null)).toBe('');
    expect(geminiText({ candidates: [] })).toBe('');
    expect(geminiText({ candidates: [{ content: {} }] })).toBe('');
  });
});

describe('openAiText', () => {
  it('extrai o conteúdo da primeira choice', () => {
    expect(openAiText({ choices: [{ message: { content: 'oi' } }] })).toBe('oi');
  });
  it('forma inesperada → string vazia (nunca lança)', () => {
    expect(openAiText({})).toBe('');
    expect(openAiText(null)).toBe('');
    expect(openAiText({ choices: [{}] })).toBe('');
  });
});
