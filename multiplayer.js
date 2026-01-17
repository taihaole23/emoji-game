
class MultiplayerManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.myId = null;
        this.isHost = false;

        // Callbacks
        this.onConnect = null; // (isHost) => {}
        this.onDisconnect = null; // () => {}
        this.onData = null; // (data) => {}

        this.retryCount = 0;
    }

    init() {
        // Create a random ID or let PeerJS assign one
        // We use a prefix to identify our game users easily if we wanted, 
        // but PeerJS IDs must be unique on the server.
        // We'll let PeerJS assign a random UUID to avoid collisions.
        this.peer = new Peer();

        this.peer.on('open', (id) => {
            console.log('My Peer ID is: ' + id);
            this.myId = id;
            if (this.onIdAssigned) this.onIdAssigned(id);
        });

        this.peer.on('connection', (conn) => {
            // Incoming connection (I am Host)
            if (this.conn) {
                // Already connected, reject others
                conn.close();
                return;
            }
            this.setupConnection(conn);
            this.isHost = true;
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS Error:', err);
            if (this.onError) this.onError(err);
        });
    }

    connectTo(hostId) {
        if (!this.peer) this.init();

        const conn = this.peer.connect(hostId);
        this.setupConnection(conn);
        this.isHost = false;
    }

    setupConnection(conn) {
        this.conn = conn;

        this.conn.on('open', () => {
            console.log('Connected to: ' + this.conn.peer);
            if (this.onConnect) this.onConnect(this.isHost);
        });

        this.conn.on('data', (data) => {
            console.log('Received data:', data);
            if (this.onData) this.onData(data);
        });

        this.conn.on('close', () => {
            console.log('Connection closed');
            this.conn = null;
            if (this.onDisconnect) this.onDisconnect();
        });

        this.conn.on('error', (err) => {
            console.error('Connection Error:', err);
        });
    }

    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        } else {
            console.warn("Cannot send data, connection not open.");
        }
    }

    cleanup() {
        if (this.conn) {
            this.conn.close();
        }
        if (this.peer) {
            this.peer.destroy();
        }
        this.peer = null;
        this.conn = null;
        this.isHost = false;
    }
}

window.Multiplayer = new MultiplayerManager();
