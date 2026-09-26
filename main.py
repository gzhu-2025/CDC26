import requests, json, xmltodict, os, time

i = 1
url = 'https://api.worldbank.org/V2/indicator?per_page=29544&format=json'


response = requests.get(url)
with open('dump.txt', 'w') as file:


    if(response.status_code == 200):
        # json_obj = json.dumps(response.text, indent=4)
        json_obj = response.json()
        # json_dict = json.loads(json_obj)
        
        for item in response.json()[1]:
            # print('\n\n')
            s = {"Poverty", "poverty"}
            for t in s:
                if(t in item["name"].split(" ")):
                    
                    file.write(str(item) + "\n")

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
