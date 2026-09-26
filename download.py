import requests, json, xmltodict, os, time


url = 'https://api.worldbank.org/V2/country/all/indicator/SI.POV.UMIC.GP?downloadformat=csv'

response = requests.get(url)
with open('data/Poverty/Poverty.zip', 'wb') as file:
    file.write(response.content)
