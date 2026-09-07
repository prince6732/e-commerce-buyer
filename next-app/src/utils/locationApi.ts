import axios from '../../utils/axios';

export interface StateItem {
  id: number;
  name: string;
  status: boolean;
}

export interface CityItem {
  id: number;
  name: string;
  stateId: number;
  status: boolean;
}

let cachedStates: StateItem[] | null = null;
const cachedCitiesByState = new Map<number, CityItem[]>();

export function clearLocationCache() {
  cachedStates = null;
  cachedCitiesByState.clear();
}

export async function fetchStates(forceRefresh = false): Promise<StateItem[]> {
  if (!forceRefresh && cachedStates && cachedStates.length > 0) {
    return cachedStates;
  }
  try {
    const res = await axios.get('/api/states');
    if (res.data?.success && Array.isArray(res.data.data)) {
      cachedStates = res.data.data;
      return res.data.data;
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch states:', error);
    return [];
  }
}

export async function fetchCitiesByState(stateId: number, forceRefresh = false): Promise<CityItem[]> {
  if (!forceRefresh && cachedCitiesByState.has(stateId)) {
    return cachedCitiesByState.get(stateId)!;
  }
  try {
    const res = await axios.get(`/api/states/${stateId}/cities`);
    if (res.data?.success && Array.isArray(res.data.data)) {
      cachedCitiesByState.set(stateId, res.data.data);
      return res.data.data;
    }
    return [];
  } catch (error) {
    console.error(`Failed to fetch cities for state ${stateId}:`, error);
    return [];
  }
}
