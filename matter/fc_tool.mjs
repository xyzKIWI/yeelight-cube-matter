// Raw Yeelight vendor-cluster invoker for the cube lamp (node 4242), reusing the shell-0 fabric.
// usage: node fc_tool.mjs <clusterHex> <commandHex> [hexTLVfields|-] [endpoint]
import "@matter/nodejs";
import { Environment, StorageService, Bytes } from "@matter/general";
import { ServerNode, ControllerBehavior, NetworkClient } from "@matter/node";
import { Invoke } from "@matter/protocol";
import { NodeId, TlvAny } from "@matter/types";

const [clusterHex, commandHex, fieldsHex = "-", ep = "2"] = process.argv.slice(2);

const env = new Environment("shell-0", Environment.default);
const node = await ServerNode.create(ServerNode.RootEndpointWithoutGroupcast.with(ControllerBehavior), {
    environment: env,
    id: "shell-0",
    network: { ble: false, tcp: true, autoStartCommissionedPeers: false },
    basicInformation: { productName: "matter.js Shell" },
    controller: { adminFabricLabel: "matter.js Shell", ble: false },
    commissioning: { enabled: false },
    subscriptions: { persistenceEnabled: false },
});
await node.start();
const peer = node.peers.commissioned.find(p => p.peerAddress?.nodeId === NodeId(4242n));
if (!peer) throw new Error("node 4242 not commissioned");
await peer.setStateOf(NetworkClient, { autoSubscribe: false });
if (peer.stateOf(NetworkClient).isDisabled) await peer.enable(); else await peer.start();

// Raw TLV passthrough schema: encodeTlv returns our pre-built bytes (or nothing).
const raw = fieldsHex === "-" ? undefined : Bytes.fromHex(fieldsHex);
const rawSchema = {
    validate() {},
    encodeTlv() { return TlvAny.decode(raw); },
};
const command = {
    requestId: parseInt(commandHex, 16),
    requestSchema: raw === undefined ? { validate() {}, encodeTlv() { return undefined; } } : rawSchema,
    responseId: parseInt(commandHex, 16),
    responseSchema: TlvAny,
    timed: false,
};
const req = Invoke({ endpoint: Number(ep), cluster: { id: parseInt(clusterHex, 16), name: "yee" }, command, fields: undefined, skipValidation: true });
let exitCode = 1; // fail unless the lamp explicitly answers with success
try {
    let responses = 0;
    let failed = false;
    for await (const chunk of peer.interaction.invoke(req)) {
        for (const entry of chunk) {
            responses++;
            console.log("RESPONSE", JSON.stringify(entry, (k, v) => typeof v === "bigint" ? v.toString() : (v instanceof Uint8Array ? Bytes.toHex(v) : v)));
            if (entry.kind === "cmd-status" && entry.status !== 0) failed = true;
        }
    }
    if (responses === 0) console.log("ERROR no response from lamp");
    else if (failed) console.log("ERROR lamp returned non-success status");
    else exitCode = 0;
} catch (e) {
    console.log("ERROR", e?.message ?? e);
}
await node.close();
process.exit(exitCode);
