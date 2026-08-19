package cc.pfa87.ods9;

import java.util.Random;

final class Kids {
    static final String[] FR_LONG = {
            "CHEVAUX", "CHEVAL", "MAISON", "ECOLE", "BANANE", "TOMATE", "FLEURS",
            "CADEAU", "BONBON", "BATEAU", "AVIONS", "SOLEIL", "GATEAU", "OISEAU",
            "ANIMAUX", "VOITURE", "FENETRE", "CAHIER", "POMMES", "FROMAGE",
            "CAROTTE", "LAPINS", "CHIENS", "CADEAUX", "BATEAUX", "MAISONS",
            "BONBONS", "TOMATES", "BANANES", "OISEAUX", "GATEAUX", "CHAUVE",
            "CUISINE", "SALADE", "FRAISE", "CERISE", "MOUTON", "POULET", "CANARD"
    };
    static final String[] EN_LONG = {
            "HORSES", "ANIMALS", "FLOWERS", "BANANA", "TOMATO", "SCHOOL", "HOUSES",
            "GARDEN", "PLANET", "FRIEND", "FAMILY", "TURTLE", "RABBIT", "CHICKEN",
            "PUPPIES", "ORANGE", "PURPLE", "BUTTON", "PENCIL", "CASTLE", "DRAGON",
            "FOREST", "ISLAND", "MOTHER", "FATHER", "SISTER", "BROTHER", "WINDOW",
            "SUMMER", "WINTER", "SPRING", "AUTUMN", "FLOWER"
    };

    static String pickLong(boolean english, Random rng) {
        String[] pool = english ? EN_LONG : FR_LONG;
        return pool[rng.nextInt(pool.length)];
    }
}
