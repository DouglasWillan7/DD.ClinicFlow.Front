/*
 * Fontes do receituário. A folha precisa das mesmas famílias que a API embute no PDF
 * para a tela bater com o documento. Importadas só por este editor, entram no pacote
 * preguiçoso da configuração da clínica, nunca no pacote inicial; o navegador só baixa
 * cada arquivo quando um texto da folha usa aquela variação.
 *
 * Só o subconjunto latino (inclui todos os acentos do português e do espanhol): os
 * arquivos por subconjunto não trazem `unicode-range`, então importar vários faria o
 * último encobrir os outros. Caractere fora dele aparece na fonte reserva só na tela;
 * o PDF usa a fonte inteira.
 */
import "@fontsource/lato/latin-400.css";
import "@fontsource/lato/latin-400-italic.css";
import "@fontsource/lato/latin-700.css";
import "@fontsource/lato/latin-700-italic.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-400-italic.css";
import "@fontsource/lora/latin-700.css";
import "@fontsource/lora/latin-700-italic.css";
