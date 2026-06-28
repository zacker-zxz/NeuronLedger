import uuid
import json
import random
from datetime import datetime
from database import SessionLocal, GraphModel
from services.graph_builder import build_graph_from_data

def generate_ip():
    return f"{random.randint(11, 250)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"

def generate_ip_network():
    nodes = []
    edges = []
    
    # ─── N O D E S ───
    # 1. Core Backbone Routers
    routers = [f"10.0.0.{i}" for i in range(1, 16)]
    for r in routers:
        nodes.append({"id": r, "label": f"BGP_Router_{r.split('.')[-1]}", "node_type": "router", "capacity": 100000})
        
    # 2. Main Datacenter Servers
    servers = [f"192.168.100.{i}" for i in range(1, 41)]
    for s in servers:
        nodes.append({"id": s, "label": f"DC_Server_{s.split('.')[-1]}", "node_type": "server", "capacity": 50000})

    # 3. Secure Nodes (Internal Admin / DB)
    secure_nodes = [f"172.16.0.{i}" for i in range(1, 11)]
    for sn in secure_nodes:
        nodes.append({"id": sn, "label": f"Secure_DB_{sn.split('.')[-1]}", "node_type": "secure_db", "capacity": 10000})
        
    # 4. Command & Control Servers (The flaws)
    c2_servers = [generate_ip() for _ in range(8)]
    for c in c2_servers:
        nodes.append({"id": c, "label": f"Dark_C2_{c.split('.')[-1]}", "node_type": "c2_server", "capacity": 5000})

    # 5. Massive Client Pool
    clients = [generate_ip() for _ in range(150)]
    for c in clients:
        nodes.append({"id": c, "label": f"Client_{c.split('.')[-1]}", "node_type": "client", "capacity": 100})

    # 6. Zombie Botnet Pool (Mixed inside clients)
    botnet_nodes = [generate_ip() for _ in range(120)]
    for b in botnet_nodes:
        nodes.append({"id": b, "label": f"Zombie_{b.split('.')[-1]}", "node_type": "botnet_node", "capacity": 100})

    # ─── E D G E S ───
    # 1. Extremely dense Router Mesh (Core backbone)
    for i in range(len(routers)):
        for j in range(i + 1, len(routers)):
            if random.random() < 0.85: # 85% meshed
                edges.append({"source": routers[i], "target": routers[j], "weight": random.randint(10000, 50000), "label": "bgp_trunk"})

    # 2. Servers cross-linked to multiple routers and each other
    for s in servers:
        # Link to 3-5 random core routers for redundancy
        for tr in random.sample(routers, random.randint(3, 5)):
            edges.append({"source": s, "target": tr, "weight": random.randint(5000, 20000), "label": "fiber_uplink"})
        # Internal lateral movement between servers
        for os in random.sample(servers, random.randint(2, 6)):
            if s != os:
                edges.append({"source": s, "target": os, "weight": random.randint(1000, 5000), "label": "internal_sync"})

    # 3. Secure DBs connected ONLY to a few trusted servers (airgapped from routers)
    for sn in secure_nodes:
        for s in random.sample(servers, random.randint(2, 4)):
            edges.append({"source": s, "target": sn, "weight": random.randint(500, 1500), "label": "db_query"})

    # 4. Dense normal client traffic (Highly interlinked)
    for c in clients:
        # Connect to 1-2 ISP routers
        for r in random.sample(routers, random.randint(1, 2)):
            edges.append({"source": c, "target": r, "weight": random.randint(100, 500), "label": "isp_link"})
        # Make varied HTTP requests to numerous servers
        for s in random.sample(servers, random.randint(4, 12)):
            edges.append({"source": c, "target": s, "weight": random.randint(10, 100), "label": "http_request"})

    # 5. Complex Flaws: Advanced Persistent Threat (APT) & Botnet activity
    target_servers = random.sample(servers, 5) # Coordinated DDoS targets
    compromised_server = random.choice(servers) # A breached server
    
    # C2 servers mapping the network
    for c2 in c2_servers:
        # C2 scanning random servers
        for s in random.sample(servers, 15):
            edges.append({"source": c2, "target": s, "weight": random.randint(1, 5), "label": "port_scan"})
        # C2 secretly tunneling to the compromised server
        edges.append({"source": c2, "target": compromised_server, "weight": random.randint(500, 1000), "label": "encrypted_tunnel"})

    # The compromised server lateral movement to Secure DBs
    for sn in secure_nodes:
        if random.random() < 0.3:
            edges.append({"source": compromised_server, "target": sn, "weight": random.randint(50, 200), "label": "unauthorized_access"})

    # Botnet swarm activity
    for b in botnet_nodes:
        # Connect to ISP
        edges.append({"source": b, "target": random.choice(routers), "weight": random.randint(100, 500), "label": "isp_link"})
        
        # Heavy C2 beaconing (all bots talk to 1-2 C2s)
        for c2 in random.sample(c2_servers, random.randint(1, 2)):
            edges.append({"source": b, "target": c2, "weight": random.randint(10, 50), "label": "c2_beacon"})
            
        # Volumetric DDoS attack on the specific target servers
        for ts in target_servers:
            if random.random() < 0.9: # 90% participation rate in the attack
                edges.append({"source": b, "target": ts, "weight": random.randint(5000, 10000), "label": "udp_flood"})
                
        # Noise traffic (botnets sending fake traffic to random servers to hide the attack)
        for s in random.sample(servers, random.randint(2, 5)):
            if s not in target_servers:
                edges.append({"source": b, "target": s, "weight": random.randint(10, 50), "label": "noise_traffic"})

    return {"nodes": nodes, "edges": edges}

def insert_mock_data():
    print("Generating MASSIVE and HIGHLY DENSE IP network graph... This may take a moment.")
    raw_data = generate_ip_network()
    print(f"Generated {len(raw_data['nodes'])} nodes and {len(raw_data['edges'])} edges.")
    
    print("Building internal graph structures (PageRank, degrees)...")
    graph_data = build_graph_from_data(raw_data)
    
    db = SessionLocal()
    try:
        new_graph = GraphModel(
            id=str(uuid.uuid4()),
            name="Ultra-Dense Cyber Threat Matrix",
            description="Massively interlinked IP network with structural flaws: a compromised server performing lateral movement, and a massive coordinated botnet swarm.",
            node_count=graph_data["node_count"],
            edge_count=graph_data["edge_count"],
            graph_data=json.dumps(graph_data),
            created_at=datetime.utcnow(),
        )
        db.add(new_graph)
        db.commit()
        print(f"Successfully inserted '{new_graph.name}' into the database!")
    except Exception as e:
        print(f"Error inserting graph: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    insert_mock_data()
