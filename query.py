import sqlite3
import sys

con = sqlite3.connect("data/activity.db")
for row in con.execute(sys.argv[1]):
    print(row)