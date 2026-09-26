import requests

url = 'https://api.worldbank.org/V2/incomeLevel/LIC/country?format=json'

response = requests.get(url)
if(response.status_code == 200):
    print(response.json())
else:
    print(f'error: {response.status_code}')