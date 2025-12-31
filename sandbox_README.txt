🧪 MQTT Sync Sandbox (Success!)

Module: MQTT Relay (via HiveMQ Public Broker)
Status: ✅ WORKING across networks (WiFi <-> 4G)

Discovery

Direct P2P (WebRTC/Trystero) failed due to NAT/Firewall blocking on mobile networks. We pivoted to a Public Relay architecture using MQTT over WebSockets.

How it Works

The Broker: We connect to wss://broker.hivemq.com:8884/mqtt. This is a free, public server that acts as a "mirror."

The Topic: We subscribe to a specific string defined by the URL Hash (e.g., listolista/sandbox/sandbox_k92...).

The Protocol:

We send JSON Packets, not just raw text.

Packet Structure: { type: 'update', elementId: 'box-a', data: 'Hello' }.

This allows us to sync multiple independent fields over a single connection channel.

Limitations (The "Catch")

Privacy: The topic is public. Anyone can listen if they guess the ID.

Persistence: The broker does not store data long-term. It is for live sync only.

Reliability: Free brokers can have rate limits.

How to Test

Open sandbox.html.

Copy the URL (ensure it has the #sandbox_... part).

Send to another device.

Type in Box A. It should appear on the other device.
