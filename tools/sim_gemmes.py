"""
Simulation économique StreetKeep — monnaie premium (gemmes) sur 365 jours.
Modèle agent-based simplifié. Hypothèses dans PARAMS (modifiables).
"""
import random, statistics, json
from collections import defaultdict

PARAMS = dict(
    jours=365,
    nouveaux_par_jour=15,          # acquisition organique constante
    churn_jour=0.02,               # 2 % des actifs partent chaque jour (~55 % retenus à 30 j)
    # profils : part des inscrits, budget max €/mois
    profils={"gratuit": (0.85, 0.0), "petit": (0.12, 5.0), "baleine": (0.03, 50.0)},
    gemmes_par_euro=100,
    prix_pack=200,                 # 1,99 €
    prix_pack_region=300,
    prix_pass=500,                 # 4,99 €/mois
    adresses_par_pack=5,
    envie_pack_jour=0.08,          # proba/jour qu'un joueur veuille un pack payant
    envie_pass_mois=0.5,           # proba qu'un payeur veuille le pass au début du mois
    envie_adresse_jour=0.04,       # proba/jour qu'un joueur veuille acheter une adresse précise à un autre joueur
    part_vendeurs_jour=0.03,       # proba/jour qu'un joueur (>10 adresses) mette une adresse en vente en gemmes
    prix_vente_moy=150,            # prix moyen demandé (gemmes)
)

class J:
    __slots__ = ("profil","budget","gemmes","adresses","actif","depense_mois","gemmes_gagnees_vente","gemmes_achetees")
    def __init__(s, profil, budget):
        s.profil=profil; s.budget=budget; s.gemmes=0; s.adresses=5; s.actif=True
        s.depense_mois=0.0; s.gemmes_gagnees_vente=0; s.gemmes_achetees=0

def tirer_profil(p):
    r=random.random(); acc=0
    for nom,(part,budget) in p["profils"].items():
        acc+=part
        if r<acc: return nom,budget
    return "gratuit",0.0

def payer(j, prix, p, stats, poste):
    """Tente de payer `prix` gemmes : d'abord avec les gemmes en poche, sinon achat en euros si budget."""
    if j.gemmes >= prix:
        j.gemmes -= prix
        stats["sink"] += prix
        # part payée avec des gemmes venues de la revente (approx. : proportion du solde d'origine revente)
        return True
    manque = prix - j.gemmes
    cout = manque / p["gemmes_par_euro"]
    if j.budget > 0 and j.depense_mois + cout <= j.budget:
        j.depense_mois += cout; stats["euros"] += cout
        j.gemmes_achetees += manque
        j.gemmes = 0; stats["sink"] += prix
        return True
    return False

def simuler(sc, seed=1):
    random.seed(seed)
    p=dict(PARAMS); p.update(sc.get("params",{}))
    commission=sc.get("commission",0.0); marche_gemmes=sc.get("marche_gemmes",True)
    sink_skins=sc.get("sink_skins",0.0)
    joueurs=[]; hist=defaultdict(list)
    for jour in range(p["jours"]):
        if jour%30==0:
            for j in joueurs: j.depense_mois=0.0
        for _ in range(p["nouveaux_par_jour"]):
            prof,b=tirer_profil(p); joueurs.append(J(prof,b))
        for j in joueurs:
            if j.actif and random.random()<p["churn_jour"]: j.actif=False
        actifs=[j for j in joueurs if j.actif]
        stats=dict(euros=0.0,sink=0,recirc=0,comm=0,ventes=0)
        for j in actifs:
            j.adresses+=p["adresses_par_pack"]  # pack gratuit
            if jour%30==0 and (j.budget>0 or j.gemmes>=p["prix_pass"]) and random.random()<p["envie_pass_mois"]:
                payer(j,p["prix_pass"],p,stats,"pass")
            if random.random()<p["envie_pack_jour"]:
                prix=p["prix_pack_region"] if random.random()<0.4 else p["prix_pack"]
                if payer(j,prix,p,stats,"pack"): j.adresses+=p["adresses_par_pack"]
            if sink_skins and j.gemmes>=150 and random.random()<sink_skins:
                j.gemmes-=150; stats["sink"]+=150
        if marche_gemmes:
            vendeurs=[j for j in actifs if j.adresses>10 and random.random()<p["part_vendeurs_jour"]]
            acheteurs=[j for j in actifs if random.random()<p["envie_adresse_jour"]]
            random.shuffle(acheteurs)
            for v,a in zip(vendeurs,acheteurs):
                if v is a: continue
                prix=max(50,int(random.gauss(p["prix_vente_moy"],50)))
                if payer(a,prix,p,stats,"adresse"):
                    comm=int(prix*commission); v.gemmes+=prix-comm; v.gemmes_gagnees_vente+=prix-comm
                    stats["sink"]-=prix  # ce n'est pas un sink : les gemmes passent au vendeur
                    stats["recirc"]+=prix-comm; stats["comm"]+=comm; stats["ventes"]+=1
                    a.adresses+=1; v.adresses-=1
        hist["actifs"].append(len(actifs)); hist["euros"].append(stats["euros"])
        hist["sink"].append(stats["sink"]); hist["recirc"].append(stats["recirc"]); hist["ventes"].append(stats["ventes"])
        hist["circ"].append(sum(j.gemmes for j in actifs))
        hist["gratuits_riches"].append(sum(1 for j in actifs if j.budget==0 and j.gemmes>=p["prix_pack"]))
        hist["payeurs"].append(sum(1 for j in actifs if j.budget>0))
    tot_ach=sum(j.gemmes_achetees for j in joueurs); tot_vente=sum(j.gemmes_gagnees_vente for j in joueurs)
    return dict(hist=hist, total_euros=sum(hist["euros"]), part_recirc=tot_vente/max(1,tot_ach))

SCENARIOS={
    "A_sans_commission":dict(commission=0.0),
    "B_commission_10":dict(commission=0.10),
    "C_commission_10_skins":dict(commission=0.10,sink_skins=0.05),
    "D_marche_en_pieces_seulement":dict(marche_gemmes=False),
    "E_sans_commission_marche_actif_x3":dict(commission=0.0,params=dict(part_vendeurs_jour=0.09,envie_adresse_jour=0.12)),
}

if __name__=="__main__":
    out={}
    for nom,sc in SCENARIOS.items():
        runs=[simuler(sc,seed=s) for s in range(6)]
        n=PARAMS["jours"]
        agg=dict(total_euros=statistics.mean(r["total_euros"] for r in runs),
                 part_recirc=statistics.mean(r["part_recirc"] for r in runs))
        for k in ("actifs","euros","sink","recirc","circ","gratuits_riches","payeurs","ventes"):
            agg[k]=[statistics.mean(r["hist"][k][d] for r in runs) for d in range(n)]
        out[nom]=agg
        print(f"\n== {nom} ==  total 12 mois : {agg['total_euros']:.0f} €   gemmes gagnées par revente / gemmes achetées en € : {agg['part_recirc']*100:.0f} %")
        for m in (1,3,6,12):
            a,b=(m-1)*30,m*30
            print(f"  mois {m:2d} | actifs {agg['actifs'][b-1]:5.0f} (payeurs {agg['payeurs'][b-1]:3.0f}) | {sum(agg['euros'][a:b]):6.0f} € | ventes entre joueurs {sum(agg['ventes'][a:b]):5.0f} | gemmes en circulation {agg['circ'][b-1]:7.0f} | gratuits pouvant payer un pack sans € {agg['gratuits_riches'][b-1]:4.0f}")
    json.dump(out,open("sim_gemmes_resultats.json","w"))
