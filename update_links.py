import re
import sys

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We want to find: <div class="field" style="margin-top:6px"><input type="number" id="PREFIX-p" placeholder="R$" required></div>
    # and replace with:
    # <div class="two-fields" style="margin-top:6px"><div class="field"><input type="number" id="PREFIX-p" placeholder="R$" required></div><div class="field"><input type="url" id="PREFIX-link" placeholder="Link da fonte" required></div></div>
    
    def replacer(match):
        full_match = match.group(0)
        id_val = match.group(1)
        # ID is usually like `ho-mt-i-cpu-p`
        link_id = id_val.rsplit('-p', 1)[0] + '-link'
        return f'<div class="two-fields" style="margin-top:6px"><div class="field"><input type="number" id="{id_val}" placeholder="R$" required></div><div class="field"><input type="url" id="{link_id}" placeholder="Link" required></div></div>'

    pattern = re.compile(r'<div class="field" style="margin-top:6px"><input type="number" id="([^"]+)" placeholder="R\$" required></div>')
    
    new_content = pattern.sub(replacer, content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print(f"Replaced {len(pattern.findall(content))} occurrences.")

if __name__ == "__main__":
    process_file("atividade_estudo_de_caso (1).html")
