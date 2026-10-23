import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:localshop_shared/localshop_shared.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/env.dart';
import '../storage/token_storage.dart';

/// `order:status` payload from the gateway.
class OrderStatusPush {
  const OrderStatusPush({required this.orderId, required this.status, required this.timestamp});

  final String orderId;
  final OrderStatus status;
  final DateTime timestamp;

  static OrderStatusPush? tryParse(dynamic raw) {
    if (raw is! Map) return null;
    final id = raw['orderId'];
    final status = raw['status'];
    if (id is! String || status is! String) return null;
    try {
      return OrderStatusPush(
        orderId: id,
        status: OrderStatus.fromValue(status),
        timestamp: DateTime.tryParse(raw['timestamp'] as String? ?? '') ?? DateTime.now(),
      );
    } catch (_) {
      return null;
    }
  }
}

/// Lazy Socket.IO connection to the API origin, authenticated with the current
/// access token at handshake time (same contract as the store panel).
///
/// The gateway only lets an order's own customer join `order:<id>`, and it also
/// emits `order:status` to `user:<customerId>`, so a connected customer hears
/// about every one of their orders. [watchOrder] joins the order room anyway
/// so the update arrives even if the handshake token lacked a user room.
///
/// This is an enhancement on top of polling: a failed connection is logged and
/// otherwise silent — the tracking screen keeps its timer as the fallback.
class OrderSocket {
  OrderSocket({required TokenStorage tokenStorage}) : _tokens = tokenStorage;

  final TokenStorage _tokens;
  io.Socket? _socket;
  final Set<String> _joinedOrders = {};
  final _statusController = StreamController<OrderStatusPush>.broadcast();
  final _connectedController = StreamController<bool>.broadcast();
  bool _connected = false;

  /// Status pushes for every order this user is allowed to see.
  Stream<OrderStatusPush> get statusUpdates => _statusController.stream;

  /// True while the socket is connected and authenticated. Lets the tracking
  /// screen slow its polling down when realtime is actually flowing.
  bool get isConnected => _connected;
  Stream<bool> get connection => _connectedController.stream;

  /// Joins `order:<orderId>` (now and after every reconnect) and returns the
  /// status stream filtered to that order. Call [unwatchOrder] when done.
  Stream<OrderStatusPush> watchOrder(String orderId) {
    _joinedOrders.add(orderId);
    final s = _ensureSocket();
    if (s.connected) _join(s, orderId);
    return statusUpdates.where((e) => e.orderId == orderId);
  }

  void unwatchOrder(String orderId) {
    _joinedOrders.remove(orderId);
    if (_joinedOrders.isEmpty) {
      // Nobody is listening: drop the connection so a backgrounded app does
      // not keep a websocket alive for nothing.
      _socket?.dispose();
      _socket = null;
      _setConnected(false);
    }
  }

  /// After a token refresh the handshake token is stale; reconnect so the new
  /// one is sent (the auth callback re-reads storage on every connect).
  void reconnect() {
    final s = _socket;
    if (s == null) return;
    s.disconnect();
    s.connect();
  }

  void dispose() {
    _joinedOrders.clear();
    _socket?.dispose();
    _socket = null;
    _statusController.close();
    _connectedController.close();
  }

  io.Socket _ensureSocket() {
    final existing = _socket;
    if (existing != null) return existing;

    final socket = io.io(
      Env.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(10000)
          // Read the token at every (re)connect so a refreshed token is picked up.
          .setAuthFn((callback) {
            _tokens.getAccessToken().then((token) => callback({'token': token ?? ''}));
          })
          .build(),
    );

    socket.onConnect((_) {
      _setConnected(true);
      for (final id in _joinedOrders) {
        _join(socket, id);
      }
    });
    socket.onDisconnect((reason) {
      _setConnected(false);
      // The gateway closes the socket when the access token expires; socket.io
      // does not auto-reconnect from a server-initiated disconnect, so do it
      // here - the auth callback re-reads the (refreshed) token.
      if (reason == 'io server disconnect' && _joinedOrders.isNotEmpty) {
        Future<void>.delayed(const Duration(milliseconds: 500), () {
          if (_socket == socket && _joinedOrders.isNotEmpty) socket.connect();
        });
      }
    });
    socket.onConnectError((err) {
      _setConnected(false);
      if (kDebugMode) debugPrint('[socket] connect error: $err');
    });
    socket.on(SocketEvents.orderStatus, (data) {
      final push = OrderStatusPush.tryParse(data);
      if (push != null && !_statusController.isClosed) _statusController.add(push);
    });

    _socket = socket;
    socket.connect();
    return socket;
  }

  void _join(io.Socket socket, String orderId) {
    socket.emitWithAck(SocketEvents.joinOrderRoom, orderId, ack: (dynamic ack) {
      if (ack is Map && ack['event'] == 'error') {
        if (kDebugMode) debugPrint('[socket] join:order refused (${ack['code']})');
        // The gateway authenticates at handshake; an UNAUTHORIZED ack means we
        // connected with a stale/missing token. One reconnect picks up the current one.
        if (ack['code'] == 'UNAUTHORIZED') reconnect();
      }
    });
  }

  void _setConnected(bool value) {
    if (_connected == value) return;
    _connected = value;
    if (!_connectedController.isClosed) _connectedController.add(value);
  }
}
