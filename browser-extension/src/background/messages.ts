import type { ScrapedProduct, CartItem, ERPCustomer, AuthState, Branch, ServiceType } from '../types';
import type { CreateMasterOrderDto, LoginDto } from '../types/api';

// ──────────────── Message types ────────────────

export type MessageType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'GET_AUTH_STATE'
  | 'ADD_TO_CART'
  | 'REMOVE_FROM_CART'
  | 'GET_CART'
  | 'CLEAR_CART'
  | 'UPDATE_CART_ITEM'
  | 'SEARCH_CUSTOMERS'
  | 'CREATE_ORDER'
  | 'API_REQUEST';

// ──────────────── Request messages ────────────────

export interface LoginMessage {
  type: 'LOGIN';
  payload: LoginDto;
}

export interface LogoutMessage {
  type: 'LOGOUT';
}

export interface GetAuthStateMessage {
  type: 'GET_AUTH_STATE';
}

export interface AddToCartMessage {
  type: 'ADD_TO_CART';
  payload: ScrapedProduct;
}

export interface RemoveFromCartMessage {
  type: 'REMOVE_FROM_CART';
  payload: { id: string };
}

export interface GetCartMessage {
  type: 'GET_CART';
}

export interface ClearCartMessage {
  type: 'CLEAR_CART';
}

export interface UpdateCartItemMessage {
  type: 'UPDATE_CART_ITEM';
  payload: { id: string; updates: Partial<CartItem> };
}

export interface SearchCustomersMessage {
  type: 'SEARCH_CUSTOMERS';
  payload: { search: string; limit?: number };
}

export interface CreateOrderMessage {
  type: 'CREATE_ORDER';
  payload: CreateMasterOrderDto;
}

export interface ApiRequestMessage {
  type: 'API_REQUEST';
  payload: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    body?: unknown;
    params?: Record<string, string>;
  };
}

export type ExtensionMessage =
  | LoginMessage
  | LogoutMessage
  | GetAuthStateMessage
  | AddToCartMessage
  | RemoveFromCartMessage
  | GetCartMessage
  | ClearCartMessage
  | UpdateCartItemMessage
  | SearchCustomersMessage
  | CreateOrderMessage
  | ApiRequestMessage;

// ──────────────── Response types ────────────────

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
