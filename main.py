import requests, json, xmltodict, os, time

i = 1
url = 'https://api.worldbank.org/V2/country/all/indicator?format=json'

response = requests.get(url)
# with open('data/GDP/GDP.zip', 'wb') as file:
#     file.write(response.content)

if(response.status_code == 200):
    # json_obj = json.dumps(response.text, indent=4)
    json_obj = response.json()
    # json_dict = json.loads(json_obj)
    print(response.json())
    
    for item in response.json()[1]:
        # print('\n\n')
        s = {"Gross domestic product", "gross domestic product", "GDP"}
        for t in s:
            if(t in item["name"].split(" ")):
                print(item)
        # print(item)
        


    # for item in response:
    #     print('\n\n')
    #     print(item)
else:
    # print(json.dumps(response, indent=4))
    obj_dict = xmltodict.parse(response.text)
    json_obj = json.dumps(obj_dict, indent=4)
    json_dict = json.loads(json_obj)

    html = json_dict["html"]
    body = html["body"]
    div = body["div"]
    p = div["p"]

    print(f'error: ({response.status_code}) {p[1]}')
