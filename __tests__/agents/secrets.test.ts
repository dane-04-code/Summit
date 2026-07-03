const mockGetItemAsync = jest.fn().mockResolvedValue('the-key');
const mockSetItemAsync = jest.fn().mockResolvedValue(undefined);
const mockDeleteItemAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

import { deleteAgentSecret, getAgentSecret, setAgentSecret } from '@/agents/secrets';

describe('agent secrets', () => {
  beforeEach(() => jest.clearAllMocks());

  it('namespaces the Keychain key per agent', async () => {
    await getAgentSecret('abc');
    expect(mockGetItemAsync).toHaveBeenCalledWith('agent.abc.secret');
  });

  it('writes the secret under the same key', async () => {
    await setAgentSecret('abc', 'sk-123');
    expect(mockSetItemAsync).toHaveBeenCalledWith('agent.abc.secret', 'sk-123');
  });

  it('deletes by the same key', async () => {
    await deleteAgentSecret('abc');
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('agent.abc.secret');
  });

  it('returns the stored value', async () => {
    await expect(getAgentSecret('abc')).resolves.toBe('the-key');
  });
});
