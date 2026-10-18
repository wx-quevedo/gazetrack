import sqlite3
import sys
from datetime import datetime, timedelta

# Uso: python check_onscreen.py 3   (consulta los ultimos 3 minutos)
minutes = int(sys.argv[1]) if len(sys.argv) > 1 else 3
start = (datetime.now() - timedelta(minutes=minutes)).isoformat(timespec="seconds")
con = sqlite3.connect("data/activity.db")
row = con.execute(
    "SELECT ROUND(AVG(on_screen)*100,1), COUNT(*) FROM samples WHERE ts >= ?",
    (start,),
).fetchone()
print(f"ultimos {minutes} min -> on-screen: {row[0]}%  |  intervalos: {row[1]}")